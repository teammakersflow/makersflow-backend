import { LessonProgressService } from './lesson-progress.service';
import { CertificatesService } from '../certificates/certificates.service';

/**
 * enrollments.completed_at = date the course was FIRST completed (2026-11-13).
 * In-memory fake of the tables the services touch, so whole sequences
 * (complete, rewatch, add lesson, complete again) run through the real code.
 */
function fakeDb() {
  const db = {
    lessons: [] as Array<{ id: bigint; course_id: bigint }>,
    progress: [] as Array<any>,
    enrollment: {
      id: 'e1',
      user_id: 'u1',
      course_id: 7n,
      payment_status: 'completed',
      expires_at: null as Date | null,
      completed_at: null as Date | null,
    },
    certificate: null as null | { issued_at: Date; course_id: bigint },
  };
  let nextId = 1n;
  const where = (rows: any[], w: any) =>
    rows.filter(
      (r) =>
        (w?.user_id === undefined || r.user_id === w.user_id) &&
        (w?.course_id === undefined || r.course_id === w.course_id),
    );
  const prisma: any = {
    enrollments: {
      findFirst: jest.fn(async () => db.enrollment),
      updateMany: jest.fn(async ({ where: w, data }: any) => {
        const e = db.enrollment;
        const match =
          e.user_id === w.user_id &&
          e.course_id === w.course_id &&
          (w.completed_at !== null || e.completed_at === null);
        if (match) Object.assign(e, data);
        return { count: match ? 1 : 0 };
      }),
    },
    lessons: {
      findUnique: jest.fn(async ({ where: w }: any) => {
        const l = db.lessons.find((x) => x.id === w.id);
        return l ? { ...l, modules: { course_id: l.course_id } } : null;
      }),
      findMany: jest.fn(async ({ where: w }: any) =>
        db.lessons
          .filter((l) => l.course_id === w.modules.course_id)
          .map((l, i) => ({ id: l.id, module_id: 1n, title: `L${l.id}`, order_index: i })),
      ),
    },
    lesson_progress: {
      findUnique: jest.fn(async ({ where: w }: any) => {
        if (w.id !== undefined) return db.progress.find((p) => p.id === w.id) ?? null;
        const k = w.user_id_course_id_lesson_id;
        return db.progress.find((p) => p.user_id === k.user_id && p.course_id === k.course_id && p.lesson_id === k.lesson_id) ?? null;
      }),
      findMany: jest.fn(async ({ where: w }: any) => where(db.progress, w)),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId++, ...data };
        db.progress.push(row);
        return row;
      }),
      update: jest.fn(async ({ where: w, data }: any) => {
        const row = db.progress.find((p) => p.id === w.id);
        Object.assign(row, data);
        return row;
      }),
    },
    certificates: {
      findUnique: jest.fn(async () => db.certificate),
      create: jest.fn(async ({ data }: any) => {
        db.certificate = { issued_at: new Date(), course_id: data.course_id };
        return { id: 'c1', ...data, issued_at: db.certificate.issued_at };
      }),
    },
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  const service = new LessonProgressService(prisma, { recordActivity: jest.fn() } as any);
  const complete = async (lessonId: bigint) => {
    const row = db.progress.find((p) => p.lesson_id === lessonId);
    if (row) return service.update('u1', row.id, { is_completed: true, watch_percentage: 100 } as any);
    return service.create('u1', { course_id: 7, lesson_id: Number(lessonId), is_completed: true, watch_percentage: 100 } as any);
  };
  const status = () => service.findMyCourseProgress('u1', 7n);
  return { db, prisma, service, complete, status };
}

describe('first-completion date (enrollments.completed_at)', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-11-01T10:00:00Z') }));
  afterEach(() => jest.useRealTimers());

  it('is set when the learner first completes every current lesson, not before', async () => {
    const { db, complete, status } = fakeDb();
    db.lessons.push({ id: 1n, course_id: 7n }, { id: 2n, course_id: 7n });
    await complete(1n);
    expect(db.enrollment.completed_at).toBeNull();
    expect((await status()).is_completed).toBe(false);

    jest.setSystemTime(new Date('2026-11-02T09:00:00Z'));
    await complete(2n);
    expect(db.enrollment.completed_at).toEqual(new Date('2026-11-02T09:00:00Z'));
    expect((await status()).is_completed).toBe(true);
  });

  it('is never overwritten by rewatches or repeated completions', async () => {
    const { db, service, complete } = fakeDb();
    db.lessons.push({ id: 1n, course_id: 7n });
    await complete(1n);
    const first = db.enrollment.completed_at;

    jest.setSystemTime(new Date('2026-11-20T09:00:00Z'));
    // rewatch: playback update without completion
    await service.update('u1', 1n, { current_time_secs: 30, watch_percentage: 20, last_watched_at: '2026-11-20T09:00:00Z' } as any);
    // replay of a completion for an already completed lesson
    await service.update('u1', 1n, { is_completed: true, watch_percentage: 100 } as any);
    expect(db.enrollment.completed_at).toEqual(first);
  });

  it('adding a lesson makes the course In Progress; the original date stays', async () => {
    const { db, complete, status } = fakeDb();
    db.lessons.push({ id: 1n, course_id: 7n });
    await complete(1n);
    const first = db.enrollment.completed_at;

    db.lessons.push({ id: 2n, course_id: 7n }); // admin adds a lesson
    const s = await status();
    expect(s.is_completed).toBe(false);
    expect(s.completion_percentage).toBe(50);
    expect(db.enrollment.completed_at).toEqual(first); // date kept, status live
  });

  it('completing the newly added lesson completes the course again with the ORIGINAL date', async () => {
    const { db, complete, status } = fakeDb();
    db.lessons.push({ id: 1n, course_id: 7n });
    await complete(1n);
    const first = db.enrollment.completed_at;

    db.lessons.push({ id: 2n, course_id: 7n });
    jest.setSystemTime(new Date('2026-12-05T09:00:00Z'));
    await complete(2n);
    expect((await status()).is_completed).toBe(true);
    expect(db.enrollment.completed_at).toEqual(first);
  });

  it('a course completed before stamping existed uses its certificate date, not today', async () => {
    const { db, prisma, service } = fakeDb();
    db.lessons.push({ id: 1n, course_id: 7n }, { id: 2n, course_id: 7n });
    // historical: lesson 1 completed, certificate issued earlier, completed_at empty
    db.progress.push({ id: 50n, user_id: 'u1', course_id: 7n, lesson_id: 1n, is_completed: true });
    db.certificate = { issued_at: new Date('2026-10-01T08:00:00Z'), course_id: 7n };
    // a newly added lesson 2 is completed now
    jest.setSystemTime(new Date('2026-11-15T09:00:00Z'));
    await service.create('u1', { course_id: 7, lesson_id: 2, is_completed: true } as any);
    expect(db.enrollment.completed_at).toEqual(new Date('2026-10-01T08:00:00Z'));
    expect(prisma.enrollments.updateMany.mock.calls[0][0].where.completed_at).toBeNull();
  });

  it('a historical completion is not stamped by a rewatch (no transition)', async () => {
    const { db, prisma, service } = fakeDb();
    db.lessons.push({ id: 1n, course_id: 7n });
    db.progress.push({ id: 50n, user_id: 'u1', course_id: 7n, lesson_id: 1n, is_completed: true });
    await service.update('u1', 50n, { is_completed: true, watch_percentage: 100 } as any);
    await service.update('u1', 50n, { current_time_secs: 10 } as any);
    expect(prisma.enrollments.updateMany).not.toHaveBeenCalled();
    expect(db.enrollment.completed_at).toBeNull();
  });

  it('certificate eligibility follows current lessons, not completed_at', async () => {
    const { db, prisma, complete } = fakeDb();
    db.lessons.push({ id: 1n, course_id: 7n });
    await complete(1n);
    db.lessons.push({ id: 2n, course_id: 7n });
    expect(db.enrollment.completed_at).not.toBeNull();
    const certs = new CertificatesService(prisma);
    await expect(certs.createForStudent('u1', { course_id: 7 } as any)).rejects.toThrow('not eligible');
    await complete(2n);
    await expect(certs.createForStudent('u1', { course_id: 7 } as any)).resolves.toBeDefined();
  });
});
