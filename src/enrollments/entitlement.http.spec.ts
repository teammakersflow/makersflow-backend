/**
 * B-2 HTTP tests (2026-11-11). Test cases 13-17 of
 * _repair/BACKEND_STATUS_B2_PROPOSAL.md §4.5.
 *
 * Real Nest pipeline, real Passport JWT strategy and guards, and the REAL
 * EnrollmentsService, LessonsService, LessonNotesService,
 * LessonResourcesService, QuizQuestionsService and QuizAttemptsService.
 * Only Prisma and the storage signer are faked. The enrollments fake ignores
 * the status/expiry filter (worst case), so these tests prove the code-level
 * entitlement check on every content route.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await --
 * Prisma fakes and supertest bodies are untyped by design. Test-only file. */
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';

import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LessonNotesController } from '../lesson-notes/lesson-notes.controller';
import { LessonNotesService } from '../lesson-notes/lesson-notes.service';
import { LessonResourcesController } from '../lesson-resources/lesson-resources.controller';
import { LessonResourcesService } from '../lesson-resources/lesson-resources.service';
import { LessonsController } from '../lessons/lessons.controller';
import { LessonsService } from '../lessons/lessons.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuizAttemptsController } from '../quiz-attempts/quiz-attempts.controller';
import { QuizAttemptsService } from '../quiz-attempts/quiz-attempts.service';
import { QuizQuestionsController } from '../quiz-questions/quiz-questions.controller';
import { QuizQuestionsService } from '../quiz-questions/quiz-questions.service';
import { StorageService } from '../storage/storage.service';
import { EnrollmentsService } from './enrollments.service';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const SECRET = 'b2-test-secret-not-a-real-key';
const DAY = 24 * 60 * 60 * 1000;

// course 1 / module 100: lesson 10 is a preview, lesson 11 is paid.
const MODULE = { id: 100n, course_id: 1n };
const LESSONS = [
  {
    id: 10n,
    module_id: 100n,
    title: 'Preview',
    content: 'preview text',
    video_url: 'private-videos/c1/preview.mp4',
    order_index: 1,
    order: 0,
    created_at: new Date(0),
    duration_secs: 60,
    notes: ['preview-note'],
    is_preview: true,
  },
  {
    id: 11n,
    module_id: 100n,
    title: 'Paid',
    content: 'paid text',
    video_url: 'private-videos/c1/paid.mp4',
    order_index: 2,
    order: 0,
    created_at: new Date(0),
    duration_secs: 120,
    notes: ['paid-note'],
    is_preview: false,
  },
];

// One enrollment per user in course 1 (u-none has none).
const ENROLLMENTS: Record<
  string,
  { payment_status: string; expires_at: Date | null }
> = {
  'u-ok': { payment_status: 'completed', expires_at: null },
  'u-upper': {
    payment_status: 'PAID',
    expires_at: new Date(Date.now() + 30 * DAY),
  },
  'u-expired': {
    payment_status: 'completed',
    expires_at: new Date(Date.now() - DAY),
  },
  'u-processing': { payment_status: 'processing', expires_at: null },
  'u-refunded': { payment_status: 'refunded', expires_at: null },
};

function project(r: any, select: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(select)) {
    if (!v) continue;
    out[k] = k === 'modules' ? { course_id: MODULE.course_id } : r[k];
  }
  return out;
}

const prisma: any = {
  lessons: {
    findMany: jest.fn(async (args?: any) =>
      LESSONS.map((l) => (args?.select ? project(l, args.select) : { ...l })),
    ),
    findUnique: jest.fn(async (args: any) => {
      const l = LESSONS.find((x) => x.id === args.where.id);
      if (!l) return null;
      if (args.select) return project(l, args.select);
      return args.include?.modules
        ? { ...l, modules: { course_id: MODULE.course_id } }
        : { ...l };
    }),
  },
  enrollments: {
    // Permissive: ignores the status/expiry filter on purpose.
    findFirst: jest.fn(async (args: any) => {
      const e = ENROLLMENTS[args.where.user_id];
      return e && args.where.course_id === MODULE.course_id
        ? {
            id: `enr-${args.where.user_id}`,
            user_id: args.where.user_id,
            course_id: MODULE.course_id,
            ...e,
            courses: { id: MODULE.course_id, thumbnail_url: null },
          }
        : null;
    }),
  },
  lesson_notes: {
    findMany: jest.fn(async () => [
      { id: 'note-1', content: 'a note', position: 0 },
    ]),
  },
  lesson_resources: {
    findMany: jest.fn(async () => [{ id: 'res-1', title: 'worksheet' }]),
  },
  quiz_questions: {
    findMany: jest.fn(async (args: any) =>
      args.select?.correct_option_index
        ? [{ id: 'qq-1', correct_option_index: 0 }]
        : [
            {
              id: 'qq-1',
              question_text: 'Q?',
              options: ['a', 'b'],
              position: 0,
            },
          ],
    ),
  },
  quizzes: { findFirst: jest.fn(async () => ({ id: 'quiz-1' })) },
  quiz_attempts: { create: jest.fn(async () => ({ id: 'attempt-1' })) },
};

const storage = {
  createSignedImageUrl: jest.fn(async () => null),
  createSignedPlaybackUrl: jest.fn(async (p: string) => ({
    url: `https://signed.example/${encodeURIComponent(p)}?sig=x`,
  })),
};

const as = (sub: string) =>
  `Bearer ${jwt.sign(
    { sub, email: `${sub}@example.test`, role: 'student' },
    SECRET,
    {
      expiresIn: '5m',
    },
  )}`;

const DENIED = ['u-expired', 'u-processing', 'u-refunded', 'u-none'];
const ALLOWED = ['u-ok', 'u-upper'];

describe('B-2 entitlement on content routes (HTTP)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    const ref = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
      ],
      controllers: [
        LessonsController,
        LessonNotesController,
        LessonResourcesController,
        QuizQuestionsController,
        QuizAttemptsController,
      ],
      providers: [
        JwtStrategy,
        RolesGuard,
        EnrollmentsService,
        LessonsService,
        LessonNotesService,
        LessonResourcesService,
        QuizQuestionsService,
        QuizAttemptsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    app = ref.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 13.
  describe('GET /lessons/:id and /lessons/:id/video (paid lesson)', () => {
    it.each(DENIED)('%s: 403 and nothing is signed', async (user) => {
      await http()
        .get('/lessons/11')
        .set('Authorization', as(user))
        .expect(403);
      await http()
        .get('/lessons/11/video')
        .set('Authorization', as(user))
        .expect(403);
      expect(storage.createSignedPlaybackUrl).not.toHaveBeenCalled();
    });

    it.each(ALLOWED)('%s: 200 with content and a signed URL', async (user) => {
      const res = await http()
        .get('/lessons/11')
        .set('Authorization', as(user))
        .expect(200);
      expect(res.body.content).toBe('paid text');
      const video = await http()
        .get('/lessons/11/video')
        .set('Authorization', as(user))
        .expect(200);
      expect(video.body.url).toContain('https://signed.example/');
    });
  });

  // 14.
  describe('GET /lessons (list)', () => {
    it.each(DENIED)(
      '%s: no content or notes for the paid lesson',
      async (user) => {
        const res = await http()
          .get('/lessons')
          .set('Authorization', as(user))
          .expect(200);
        const paid = res.body.find((l: any) => l.id === '11');
        expect(paid.content).toBeNull();
        expect(paid.notes).toEqual([]);
      },
    );

    it.each(ALLOWED)(
      '%s: content and notes for the paid lesson',
      async (user) => {
        const res = await http()
          .get('/lessons')
          .set('Authorization', as(user))
          .expect(200);
        const paid = res.body.find((l: any) => l.id === '11');
        expect(paid.content).toBe('paid text');
        expect(paid.notes).toEqual(['paid-note']);
      },
    );
  });

  // 15.
  describe('POST /quiz-attempts/submit', () => {
    it.each(DENIED)('%s: 403 and no attempt is recorded', async (user) => {
      await http()
        .post('/quiz-attempts/submit')
        .set('Authorization', as(user))
        .send({ lesson_id: '11', answers: { 'qq-1': 0 } })
        .expect(403);
      expect(prisma.quiz_attempts.create).not.toHaveBeenCalled();
    });

    it.each(ALLOWED)('%s: 201 and graded on the server', async (user) => {
      const res = await http()
        .post('/quiz-attempts/submit')
        .set('Authorization', as(user))
        .send({ lesson_id: '11', answers: { 'qq-1': 0 } })
        .expect(201);
      expect(res.body.score).toBe(1);
    });
  });

  // 16.
  describe('notes, resources and quiz questions for the paid lesson', () => {
    const routes = [
      '/lesson-notes/lesson/11',
      '/lesson-notes?lessonId=11',
      '/lesson-resources/lesson/11',
      '/lesson-resources?lessonId=11',
      '/quiz-questions/lesson/11',
    ];

    it.each(DENIED)('%s: 403 on every route', async (user) => {
      for (const route of routes) {
        await http().get(route).set('Authorization', as(user)).expect(403);
      }
      expect(prisma.lesson_notes.findMany).not.toHaveBeenCalled();
      expect(prisma.lesson_resources.findMany).not.toHaveBeenCalled();
      expect(prisma.quiz_questions.findMany).not.toHaveBeenCalled();
    });

    it.each(ALLOWED)('%s: 200 on every route', async (user) => {
      for (const route of routes) {
        await http().get(route).set('Authorization', as(user)).expect(200);
      }
    });
  });

  // 17.
  describe('preview lesson stays open to any signed-in user', () => {
    it.each(['u-none', 'u-expired', 'u-refunded'])(
      '%s: preview lesson, video, notes, resources and quiz are readable',
      async (user) => {
        const res = await http()
          .get('/lessons/10')
          .set('Authorization', as(user))
          .expect(200);
        expect(res.body.content).toBe('preview text');
        await http()
          .get('/lessons/10/video')
          .set('Authorization', as(user))
          .expect(200);
        await http()
          .get('/lesson-notes/lesson/10')
          .set('Authorization', as(user))
          .expect(200);
        await http()
          .get('/lesson-resources/lesson/10')
          .set('Authorization', as(user))
          .expect(200);
        await http()
          .get('/quiz-questions/lesson/10')
          .set('Authorization', as(user))
          .expect(200);
      },
    );

    it('anonymous callers still get 401 on the preview lesson detail', async () => {
      await http().get('/lessons/10').expect(401);
    });
  });
});
