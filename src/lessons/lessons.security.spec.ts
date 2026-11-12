/**
 * B-1 regression tests (2026-11-11).
 *
 * HTTP-level: requests go through the real Nest pipeline, the real Passport
 * JWT strategy, JwtAuthGuard / OptionalJwtAuthGuard / RolesGuard, and the real
 * LessonsService and ModulesService. Only the database (Prisma), enrollment
 * lookup and storage signer are replaced with in-memory fakes.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await --
 * The fakes emulate Prisma's dynamic `select` and supertest's untyped JSON
 * bodies; typing them adds noise without adding safety. Test-only file. */
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';

import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ModulesController } from '../modules/modules.controller';
import {
  ModulesService,
  PUBLIC_MODULE_FIELDS,
} from '../modules/modules.service';
import { LessonsController } from './lessons.controller';
import { LessonsService, PROTECTED_VIDEO_MARKER } from './lessons.service';

// main.ts installs this at runtime; the test app needs it too.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const SECRET = 'b1-test-secret-not-a-real-key';
const RAW_PATH_PREFIX = 'private-videos/';

// course 1: lesson 10 (preview), 11 (paid). course 2: lesson 20 (paid).
const MODULES = [
  {
    id: 100n,
    course_id: 1n,
    title: 'Intro',
    description: 'd',
    order_index: 1,
    order: 0,
    duration_mins: 5,
    created_at: new Date(0),
    internal_secret_column: 'never-public',
  },
  {
    id: 200n,
    course_id: 2n,
    title: 'Advanced',
    description: 'd',
    order_index: 1,
    order: 0,
    duration_mins: 9,
    created_at: new Date(0),
    internal_secret_column: 'never-public',
  },
];
const LESSONS = [
  {
    id: 10n,
    module_id: 100n,
    title: 'Welcome',
    content: 'preview text',
    video_url: `${RAW_PATH_PREFIX}c1/welcome.mp4`,
    order_index: 1,
    order: 0,
    created_at: new Date(0),
    duration_secs: 60,
    notes: ['p-note'],
    is_preview: true,
  },
  {
    id: 11n,
    module_id: 100n,
    title: 'Paid one',
    content: 'paid text course 1',
    video_url: `${RAW_PATH_PREFIX}c1/paid.mp4`,
    order_index: 2,
    order: 0,
    created_at: new Date(0),
    duration_secs: 120,
    notes: ['c1-note'],
    is_preview: false,
  },
  {
    id: 20n,
    module_id: 200n,
    title: 'Paid two',
    content: 'paid text course 2',
    video_url: `${RAW_PATH_PREFIX}c2/paid.mp4`,
    order_index: 1,
    order: 0,
    created_at: new Date(0),
    duration_secs: 300,
    notes: ['c2-note'],
    is_preview: false,
  },
  {
    id: 21n,
    module_id: 200n,
    title: 'Text only',
    content: 'text course 2',
    video_url: null,
    order_index: 2,
    order: 0,
    created_at: new Date(0),
    duration_secs: null,
    notes: [],
    is_preview: false,
  },
];

/** Applies a Prisma-style `select` (including one nested relation select). */
function project(row: any, select: any) {
  if (!select) return { ...row };
  const out: any = {};
  for (const [key, val] of Object.entries(select)) {
    if (!val) continue;
    if (key === 'modules') {
      const mod = MODULES.find((m) => m.id === row.module_id)!;
      out.modules = (val as any).select
        ? project(mod, (val as any).select)
        : { ...mod };
    } else {
      out[key] = row[key];
    }
  }
  return out;
}

function withModule(row: any, include: any) {
  if (!include?.modules) return { ...row };
  const mod = MODULES.find((m) => m.id === row.module_id)!;
  return {
    ...row,
    modules: include.modules.select
      ? project(mod, include.modules.select)
      : { ...mod },
  };
}

const prisma = {
  lessons: {
    findMany: jest.fn(async (args?: any) =>
      LESSONS.map((l) => project(l, args?.select)),
    ),
    findUnique: jest.fn(async (args: any) => {
      const row = LESSONS.find((l) => l.id === args.where.id);
      if (!row) return null;
      return args.select
        ? project(row, args.select)
        : withModule(row, args.include);
    }),
    update: jest.fn(async (args: any) => ({ ...LESSONS[0], ...args.data })),
    create: jest.fn(),
    delete: jest.fn(),
  },
  modules: {
    findMany: jest.fn(async (args?: any) =>
      MODULES.map((m) => project(m, args?.select)),
    ),
    findUnique: jest.fn(async (args: any) => {
      const row = MODULES.find((m) => m.id === args.where.id);
      return row ? project(row, args.select) : null;
    }),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// student-a is enrolled in course 1 only. student-b has no enrollments.
const enrollments = {
  findMyEnrollment: jest.fn(async (userId: string, courseId: bigint) =>
    userId === 'student-a' && courseId === 1n
      ? { id: 1n, user_id: userId, course_id: courseId }
      : null,
  ),
};

const storage = {
  createSignedPlaybackUrl: jest.fn(async (path: string) => ({
    url: `https://signed.example/${encodeURIComponent(path)}?sig=x`,
  })),
};

function token(
  sub: string,
  role: string,
  opts: jwt.SignOptions = {},
  secret = SECRET,
) {
  return jwt.sign({ sub, email: `${sub}@example.test`, role }, secret, {
    expiresIn: '5m',
    ...opts,
  });
}
const STUDENT_A = () => `Bearer ${token('student-a', 'student')}`;
const STUDENT_B = () => `Bearer ${token('student-b', 'student')}`;
const ADMIN = () => `Bearer ${token('admin-1', 'admin')}`;
const INSTRUCTOR = () => `Bearer ${token('instr-1', 'instructor')}`;

function containsRawPath(body: unknown) {
  return JSON.stringify(body).includes(RAW_PATH_PREFIX);
}

describe('B-1 lessons/modules access boundary (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
      ],
      controllers: [LessonsController, ModulesController],
      providers: [
        JwtStrategy,
        RolesGuard,
        LessonsService,
        ModulesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentsService, useValue: enrollments },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /lessons ─────────────────────────────────────────────────────────
  describe('GET /lessons', () => {
    it('anonymous: 200 with curriculum metadata only (no raw video path, no content, no notes)', async () => {
      const res = await request(app.getHttpServer())
        .get('/lessons')
        .expect(200);

      expect(res.body).toHaveLength(LESSONS.length);
      expect(containsRawPath(res.body)).toBe(false);
      for (const l of res.body) {
        expect(l.content).toBeNull();
        expect(l.notes).toEqual([]);
        expect(typeof l.title).toBe('string');
        expect(l).toHaveProperty('module_id');
        expect(l).toHaveProperty('duration_secs');
      }
      const byId = Object.fromEntries(res.body.map((l: any) => [l.id, l]));
      expect(byId['11'].video_url).toBe(PROTECTED_VIDEO_MARKER);
      expect(byId['11'].has_video).toBe(true);
      expect(byId['21'].video_url).toBeNull();
      expect(byId['21'].has_video).toBe(false);
    });

    it('anonymous: content and notes are not even read from the database', async () => {
      await request(app.getHttpServer()).get('/lessons').expect(200);
      const select = prisma.lessons.findMany.mock.calls[0][0].select;
      expect(select.content).toBe(false);
      expect(select.notes).toBe(false);
      expect(enrollments.findMyEnrollment).not.toHaveBeenCalled();
    });

    it('expired token is treated as anonymous (no content)', async () => {
      const expired = token('student-a', 'student', { expiresIn: -10 });
      const res = await request(app.getHttpServer())
        .get('/lessons')
        .set('Authorization', `Bearer ${expired}`)
        .expect(200);
      expect(res.body.every((l: any) => l.content === null)).toBe(true);
      expect(containsRawPath(res.body)).toBe(false);
    });

    it('token signed with the wrong key is treated as anonymous, even with role admin', async () => {
      const forged = token('attacker', 'admin', {}, 'some-other-key');
      const res = await request(app.getHttpServer())
        .get('/lessons')
        .set('Authorization', `Bearer ${forged}`)
        .expect(200);
      expect(containsRawPath(res.body)).toBe(false);
      expect(res.body.every((l: any) => l.content === null)).toBe(true);
    });

    it('enrolled student: content for preview + enrolled course only; never the raw path', async () => {
      const res = await request(app.getHttpServer())
        .get('/lessons')
        .set('Authorization', STUDENT_A())
        .expect(200);
      const byId = Object.fromEntries(res.body.map((l: any) => [l.id, l]));

      expect(byId['10'].content).toBe('preview text');
      expect(byId['11'].content).toBe('paid text course 1');
      expect(byId['11'].notes).toEqual(['c1-note']);
      expect(byId['20'].content).toBeNull();
      expect(byId['20'].notes).toEqual([]);
      expect(byId['21'].content).toBeNull();
      expect(containsRawPath(res.body)).toBe(false);
    });

    it('signed-in but not enrolled: preview content only', async () => {
      const res = await request(app.getHttpServer())
        .get('/lessons')
        .set('Authorization', STUDENT_B())
        .expect(200);
      const byId = Object.fromEntries(res.body.map((l: any) => [l.id, l]));
      expect(byId['10'].content).toBe('preview text');
      expect(byId['11'].content).toBeNull();
      expect(byId['20'].content).toBeNull();
      expect(containsRawPath(res.body)).toBe(false);
    });

    it('instructor role gets no admin view', async () => {
      const res = await request(app.getHttpServer())
        .get('/lessons')
        .set('Authorization', INSTRUCTOR())
        .expect(200);
      expect(containsRawPath(res.body)).toBe(false);
      expect(res.body.find((l: any) => l.id === '11').content).toBeNull();
    });

    it('admin: full rows (unchanged admin behaviour)', async () => {
      const res = await request(app.getHttpServer())
        .get('/lessons')
        .set('Authorization', ADMIN())
        .expect(200);
      const byId = Object.fromEntries(res.body.map((l: any) => [l.id, l]));
      expect(byId['20'].video_url).toBe(`${RAW_PATH_PREFIX}c2/paid.mp4`);
      expect(byId['20'].content).toBe('paid text course 2');
    });
  });

  // ── GET /lessons/:id ─────────────────────────────────────────────────────
  describe('GET /lessons/:id', () => {
    it('anonymous: 401, even for a preview lesson', async () => {
      await request(app.getHttpServer()).get('/lessons/11').expect(401);
      await request(app.getHttpServer()).get('/lessons/10').expect(401);
      expect(prisma.lessons.findUnique).not.toHaveBeenCalled();
    });

    it('not enrolled: 403 for a paid lesson', async () => {
      const res = await request(app.getHttpServer())
        .get('/lessons/20')
        .set('Authorization', STUDENT_A())
        .expect(403);
      expect(containsRawPath(res.body)).toBe(false);
    });

    it('enrolled: 200 with content, raw path replaced by the marker', async () => {
      const res = await request(app.getHttpServer())
        .get('/lessons/11')
        .set('Authorization', STUDENT_A())
        .expect(200);
      expect(res.body.content).toBe('paid text course 1');
      expect(res.body.video_url).toBe(PROTECTED_VIDEO_MARKER);
      expect(res.body.has_video).toBe(true);
      expect(containsRawPath(res.body)).toBe(false);
    });

    it('preview lesson for a signed-in non-enrolled user: 200, no raw path', async () => {
      const res = await request(app.getHttpServer())
        .get('/lessons/10')
        .set('Authorization', STUDENT_B())
        .expect(200);
      expect(res.body.content).toBe('preview text');
      expect(containsRawPath(res.body)).toBe(false);
    });

    it('non-numeric id: 400 (was an unhandled BigInt error)', async () => {
      await request(app.getHttpServer())
        .get('/lessons/abc')
        .set('Authorization', STUDENT_A())
        .expect(400);
    });

    it('unknown lesson: 404', async () => {
      await request(app.getHttpServer())
        .get('/lessons/999')
        .set('Authorization', STUDENT_A())
        .expect(404);
    });

    it('admin: full row', async () => {
      const res = await request(app.getHttpServer())
        .get('/lessons/20')
        .set('Authorization', ADMIN())
        .expect(200);
      expect(res.body.video_url).toBe(`${RAW_PATH_PREFIX}c2/paid.mp4`);
    });
  });

  // ── GET /lessons/:id/video ───────────────────────────────────────────────
  describe('GET /lessons/:id/video', () => {
    it('anonymous: 401', async () => {
      await request(app.getHttpServer()).get('/lessons/11/video').expect(401);
      expect(storage.createSignedPlaybackUrl).not.toHaveBeenCalled();
    });

    it('not enrolled: 403 and nothing is signed', async () => {
      await request(app.getHttpServer())
        .get('/lessons/20/video')
        .set('Authorization', STUDENT_A())
        .expect(403);
      expect(storage.createSignedPlaybackUrl).not.toHaveBeenCalled();
    });

    it('enrolled: 200 with a signed URL', async () => {
      const res = await request(app.getHttpServer())
        .get('/lessons/11/video')
        .set('Authorization', STUDENT_A())
        .expect(200);
      expect(res.body.url).toContain('https://signed.example/');
      expect(storage.createSignedPlaybackUrl).toHaveBeenCalledTimes(1);
    });
  });

  // ── Admin-only lesson writes ─────────────────────────────────────────────
  describe('lesson writes', () => {
    it('POST /lessons: 401 anonymous, 403 student', async () => {
      await request(app.getHttpServer())
        .post('/lessons')
        .send({ title: 'x' })
        .expect(401);
      await request(app.getHttpServer())
        .post('/lessons')
        .set('Authorization', STUDENT_A())
        .send({ title: 'x' })
        .expect(403);
      expect(prisma.lessons.create).not.toHaveBeenCalled();
    });

    it('PATCH /lessons/:id: 403 for a student', async () => {
      await request(app.getHttpServer())
        .patch('/lessons/11')
        .set('Authorization', STUDENT_A())
        .send({ title: 'x' })
        .expect(403);
      expect(prisma.lessons.update).not.toHaveBeenCalled();
    });

    it('PATCH /lessons/:id: admin cannot save the redaction marker as the video path', async () => {
      await request(app.getHttpServer())
        .patch('/lessons/11')
        .set('Authorization', ADMIN())
        .send({ video_url: PROTECTED_VIDEO_MARKER })
        .expect(400);
      expect(prisma.lessons.update).not.toHaveBeenCalled();
    });
  });

  // ── GET /modules ─────────────────────────────────────────────────────────
  describe('GET /modules', () => {
    it('anonymous: 200 with the public field allow-list only', async () => {
      const res = await request(app.getHttpServer())
        .get('/modules')
        .expect(200);
      expect(prisma.modules.findMany.mock.calls[0][0].select).toEqual(
        PUBLIC_MODULE_FIELDS,
      );
      expect(res.body).toHaveLength(2);
      for (const m of res.body) {
        expect(Object.keys(m).sort()).toEqual(
          Object.keys(PUBLIC_MODULE_FIELDS).sort(),
        );
        expect(m).not.toHaveProperty('internal_secret_column');
      }
    });

    it('GET /modules/:id: 200 public fields; 400 for a non-numeric id', async () => {
      const res = await request(app.getHttpServer())
        .get('/modules/100')
        .expect(200);
      expect(res.body.title).toBe('Intro');
      expect(res.body).not.toHaveProperty('internal_secret_column');
      await request(app.getHttpServer()).get('/modules/abc').expect(400);
    });

    it('module writes: 401 anonymous, 403 student', async () => {
      await request(app.getHttpServer())
        .post('/modules')
        .send({ title: 'x' })
        .expect(401);
      await request(app.getHttpServer())
        .post('/modules')
        .set('Authorization', STUDENT_A())
        .send({ title: 'x' })
        .expect(403);
      await request(app.getHttpServer())
        .delete('/modules/100')
        .set('Authorization', STUDENT_A())
        .expect(403);
      expect(prisma.modules.create).not.toHaveBeenCalled();
      expect(prisma.modules.delete).not.toHaveBeenCalled();
    });
  });
});
