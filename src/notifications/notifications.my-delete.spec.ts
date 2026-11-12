/**
 * 2026-11-11 integration: DELETE /notifications/my/:id (student-scoped).
 * Real Nest pipeline, Passport JWT strategy and guards; Prisma is faked.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await --
 * Prisma fake is untyped by design. Test-only file. */
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';

import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

const SECRET = 'notif-test-secret-not-a-real-key';
const MINE = '11111111-1111-4111-8111-111111111111';
const OTHERS = '22222222-2222-4222-8222-222222222222';

const rows = () => [
  { id: MINE, user_id: 'student-a' },
  { id: OTHERS, user_id: 'student-b' },
];
let table = rows();

const prisma: any = {
  notifications: {
    deleteMany: jest.fn(async (args: any) => {
      const before = table.length;
      table = table.filter(
        (r) => !(r.id === args.where.id && r.user_id === args.where.user_id),
      );
      return { count: before - table.length };
    }),
    delete: jest.fn(),
  },
};

const as = (sub: string, role = 'student') =>
  `Bearer ${jwt.sign({ sub, email: `${sub}@example.test`, role }, SECRET, {
    expiresIn: '5m',
  })}`;

describe('DELETE /notifications/my/:id', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    const ref = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
      ],
      controllers: [NotificationsController],
      providers: [
        JwtStrategy,
        RolesGuard,
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = ref.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    table = rows();
    jest.clearAllMocks();
  });

  it('401 without a token', async () => {
    await http().delete(`/notifications/my/${MINE}`).expect(401);
    expect(prisma.notifications.deleteMany).not.toHaveBeenCalled();
  });

  it('200 and deletes the caller’s own notification', async () => {
    const res = await http()
      .delete(`/notifications/my/${MINE}`)
      .set('Authorization', as('student-a'))
      .expect(200);
    expect(res.body).toEqual({ success: true });
    expect(prisma.notifications.deleteMany).toHaveBeenCalledWith({
      where: { id: MINE, user_id: 'student-a' },
    });
    expect(table.find((r) => r.id === MINE)).toBeUndefined();
  });

  it('404 for another user’s notification, which is left untouched', async () => {
    await http()
      .delete(`/notifications/my/${OTHERS}`)
      .set('Authorization', as('student-a'))
      .expect(404);
    expect(table.find((r) => r.id === OTHERS)).toBeDefined();
  });

  it('400 for a non-UUID id (no database call)', async () => {
    await http()
      .delete('/notifications/my/not-a-uuid')
      .set('Authorization', as('student-a'))
      .expect(400);
    expect(prisma.notifications.deleteMany).not.toHaveBeenCalled();
  });

  it('admin DELETE /notifications/:id stays admin-only (403 for a student)', async () => {
    await http()
      .delete(`/notifications/${MINE}`)
      .set('Authorization', as('student-a'))
      .expect(403);
    expect(prisma.notifications.delete).not.toHaveBeenCalled();
  });
});
