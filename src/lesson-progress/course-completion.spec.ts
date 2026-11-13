import { ForbiddenException } from '@nestjs/common';
import { computeCourseCompletion } from './course-completion';
import { LessonProgressService } from './lesson-progress.service';
import { CertificatesService } from '../certificates/certificates.service';

const L = (...ids: number[]) => ids.map((id) => ({ id: BigInt(id) }));
const P = (lessonId: number, done: boolean) => ({
  lesson_id: BigInt(lessonId),
  is_completed: done,
});

describe('computeCourseCompletion', () => {
  it('all current lessons completed -> complete, 100%', () => {
    expect(
      computeCourseCompletion(L(1, 2, 3), [P(1, true), P(2, true), P(3, true)]),
    ).toEqual({
      total_lessons: 3,
      completed_lessons: 3,
      completion_percentage: 100,
      is_completed: true,
    });
  });

  it('partial progress is not complete', () => {
    const r = computeCourseCompletion(L(1, 2, 3), [P(1, true), P(2, false)]);
    expect(r.is_completed).toBe(false);
    expect(r.completed_lessons).toBe(1);
    expect(r.completion_percentage).toBe(33);
  });

  it('a deleted lesson with a completed row does not block completion (was 4/3 -> false, 133%)', () => {
    const r = computeCourseCompletion(L(1, 2, 3), [
      P(1, true),
      P(2, true),
      P(3, true),
      P(99, true), // lesson 99 was deleted
    ]);
    expect(r.is_completed).toBe(true);
    expect(r.completed_lessons).toBe(3);
    expect(r.completion_percentage).toBe(100);
  });

  it('a deleted lesson with a completed row does not grant completion (was 3/3 -> true)', () => {
    const r = computeCourseCompletion(L(1, 2, 3), [
      P(1, true),
      P(2, true),
      P(99, true), // stale row stands in for lesson 3, which is not done
    ]);
    expect(r.is_completed).toBe(false);
    expect(r.completed_lessons).toBe(2);
    expect(r.completion_percentage).toBe(67);
  });

  it('percentage never exceeds 100 and is never 100 while unfinished', () => {
    const lessons = L(...Array.from({ length: 200 }, (_, i) => i + 1));
    const nearly = Array.from({ length: 199 }, (_, i) => P(i + 1, true));
    const r = computeCourseCompletion(lessons, [...nearly, P(500, true), P(501, true)]);
    expect(r.is_completed).toBe(false);
    expect(r.completion_percentage).toBe(99);
  });

  it('no lessons -> never complete, 0%', () => {
    expect(computeCourseCompletion([], [P(1, true)])).toEqual({
      total_lessons: 0,
      completed_lessons: 0,
      completion_percentage: 0,
      is_completed: false,
    });
  });

  it('duplicate rows for one lesson count once', () => {
    const r = computeCourseCompletion(L(1, 2), [P(1, true), P(1, true)]);
    expect(r.completed_lessons).toBe(1);
    expect(r.is_completed).toBe(false);
  });
});

describe('services use the valid-lesson rule', () => {
  const activeEnrollment = {
    id: 'e1',
    user_id: 'u1',
    course_id: BigInt(7),
    payment_status: 'completed',
    expires_at: null,
  };

  function prismaWith(lessonIds: number[], progress: Array<ReturnType<typeof P>>) {
    return {
      enrollments: { findFirst: jest.fn().mockResolvedValue(activeEnrollment) },
      lessons: {
        findMany: jest.fn().mockResolvedValue(
          lessonIds.map((id, i) => ({
            id: BigInt(id),
            module_id: BigInt(1),
            title: `L${id}`,
            order_index: i + 1,
          })),
        ),
      },
      lesson_progress: {
        findMany: jest.fn().mockResolvedValue(
          progress.map((p, i) => ({ id: BigInt(i + 1), user_id: 'u1', course_id: BigInt(7), ...p })),
        ),
      },
      certificates: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'c1', ...data })),
      },
    };
  }

  it('findMyCourseProgress ignores progress for deleted lessons', async () => {
    const prisma = prismaWith([1, 2], [P(1, true), P(2, true), P(99, true)]);
    const service = new LessonProgressService(prisma as any, { recordActivity: jest.fn() } as any);
    const r = await service.findMyCourseProgress('u1', BigInt(7));
    expect(r.total_lessons).toBe(2);
    expect(r.completed_lessons).toBe(2);
    expect(r.completion_percentage).toBe(100);
    expect(r.is_completed).toBe(true);
    expect(r.lessons.map((l) => l.lesson_id)).toEqual(['1', '2']);
  });

  it('findMyCourseProgress: a stale completed row cannot complete the course', async () => {
    const prisma = prismaWith([1, 2], [P(1, true), P(99, true)]);
    const service = new LessonProgressService(prisma as any, { recordActivity: jest.fn() } as any);
    const r = await service.findMyCourseProgress('u1', BigInt(7));
    expect(r.is_completed).toBe(false);
    expect(r.completion_percentage).toBe(50);
  });

  it('certificate eligibility uses the same rule (stale row cannot grant)', async () => {
    const prisma = prismaWith([1, 2], [P(1, true), P(99, true)]);
    const service = new CertificatesService(prisma as any);
    await expect(service.createForStudent('u1', { course_id: 7 } as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.certificates.create).not.toHaveBeenCalled();
  });

  it('certificate eligibility uses the same rule (stale row cannot block)', async () => {
    const prisma = prismaWith([1, 2], [P(1, true), P(2, true), P(99, true)]);
    const service = new CertificatesService(prisma as any);
    const cert = await service.createForStudent('u1', { course_id: 7 } as any);
    expect(cert.course_id).toBe(BigInt(7));
    expect(prisma.certificates.create).toHaveBeenCalledTimes(1);
    // the progress query must select lesson_id so stale rows can be filtered
    expect(prisma.lesson_progress.findMany.mock.calls[0][0].select).toEqual({
      lesson_id: true,
      is_completed: true,
    });
  });
});
