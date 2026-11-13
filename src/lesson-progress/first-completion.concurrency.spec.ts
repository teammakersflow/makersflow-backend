/**
 * Real-Postgres concurrency test for the first-completion stamp.
 *
 * Runs only when CONCURRENCY_TEST_DATABASE_URL points at a DISPOSABLE Postgres
 * database that already has the Prisma schema (never production). Skipped
 * otherwise, so the normal suite does not need a database.
 *
 * Two LessonProgressService instances use two separate PrismaClients (two
 * connection pools, two real transactions). A query extension holds each
 * transaction open for HOLD_MS right after its lesson_progress write, so both
 * writes happen before either transaction reads: the race window is always
 * hit instead of depending on timing luck.
 *
 * A trigger records every change of enrollments.completed_at, so "exactly one
 * first-completion timestamp, never overwritten" is checked by the database.
 */
import { PrismaClient } from '@prisma/client';
import { LessonProgressService } from './lesson-progress.service';

const URL = process.env.CONCURRENCY_TEST_DATABASE_URL;
const HOLD_MS = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function slowClient() {
  const base = new PrismaClient({ datasourceUrl: URL });
  const hold = async ({ args, query }: any) => {
    const result = await query(args);
    await sleep(HOLD_MS);
    return result;
  };
  const client = base.$extends({
    query: { lesson_progress: { update: hold, create: hold } },
  });
  return { base, client };
}

/** Same service, but the enrollment row lock is skipped (negative control). */
function withoutLock(client: any) {
  return new Proxy(client, {
    get(target, prop) {
      if (prop !== '$transaction') return target[prop];
      return (fn: any) =>
        target.$transaction((tx: any) =>
          fn(
            new Proxy(tx, {
              get(t, p) {
                return p === '$queryRaw' ? async () => [] : t[p];
              },
            }),
          ),
        );
    },
  });
}

const noStreaks = { recordActivity: async () => undefined } as any;

(URL ? describe : describe.skip)('first-completion stamp under real concurrency', () => {
  jest.setTimeout(60_000);
  const admin = new PrismaClient({ datasourceUrl: URL });
  const a = slowClient();
  const b = slowClient();
  let seq = Math.floor(Date.now() / 1000) % 100000;

  beforeAll(async () => {
    if (!/127\.0\.0\.1|localhost/.test(URL!)) {
      throw new Error('CONCURRENCY_TEST_DATABASE_URL must be a local disposable database');
    }
    await admin.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS completed_at_audit (
        enrollment_id uuid, old_value timestamptz, new_value timestamptz, at timestamptz DEFAULT now()
      )`);
    await admin.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION audit_completed_at() RETURNS trigger AS $$
      BEGIN
        IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
          INSERT INTO completed_at_audit (enrollment_id, old_value, new_value)
          VALUES (NEW.id, OLD.completed_at, NEW.completed_at);
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await admin.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_audit_completed_at ON enrollments`);
    await admin.$executeRawUnsafe(`
      CREATE TRIGGER trg_audit_completed_at AFTER UPDATE ON enrollments
      FOR EACH ROW EXECUTE FUNCTION audit_completed_at()`);
  });

  afterAll(async () => {
    await Promise.all([admin.$disconnect(), a.base.$disconnect(), b.base.$disconnect()]);
  });

  /** A user enrolled in a fresh 2-lesson course with progress rows not completed. */
  async function setup() {
    const course = BigInt(700000 + seq++ * 10);
    const userId = (
      await admin.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id::text`,
        `conc-${course}@example.test`,
      )
    )[0].id;
    await admin.$executeRawUnsafe(`INSERT INTO courses (id, title, is_free, price, is_published) VALUES ($1, 'C', true, 0, true)`, course);
    await admin.$executeRawUnsafe(`INSERT INTO modules (id, course_id, title) VALUES ($1, $1, 'M')`, course);
    await admin.$executeRawUnsafe(`INSERT INTO lessons (id, module_id, title, order_index) VALUES ($1, $3, 'L1', 1), ($2, $3, 'L2', 2)`, course + 1n, course + 2n, course);
    const enrollmentId = (
      await admin.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO enrollments (user_id, course_id, payment_status) VALUES ($1::uuid, $2, 'completed') RETURNING id::text`,
        userId, course,
      )
    )[0].id;
    const rows = await admin.$queryRawUnsafe<{ id: bigint; lesson_id: bigint }[]>(
      `INSERT INTO lesson_progress (user_id, course_id, lesson_id, is_completed, watch_percentage)
       VALUES ($1::uuid, $2, $3, false, 40), ($1::uuid, $2, $4, false, 40) RETURNING id, lesson_id`,
      userId, course, course + 1n, course + 2n,
    );
    const progressId = (lesson: bigint) => rows.find((r) => r.lesson_id === lesson)!.id;
    return { course, userId, enrollmentId, p1: progressId(course + 1n), p2: progressId(course + 2n) };
  }

  const completedAt = async (enrollmentId: string) =>
    (await admin.$queryRawUnsafe<{ c: Date | null }[]>(`SELECT completed_at c FROM enrollments WHERE id = $1::uuid`, enrollmentId))[0].c;
  const audit = async (enrollmentId: string) =>
    admin.$queryRawUnsafe<{ old_value: Date | null; new_value: Date | null }[]>(
      `SELECT old_value, new_value FROM completed_at_audit WHERE enrollment_id = $1::uuid ORDER BY at`, enrollmentId,
    );

  it('negative control: WITHOUT the lock, completing the last two lessons concurrently misses the stamp', async () => {
    const s = await setup();
    const svcA = new LessonProgressService(withoutLock(a.client) as any, noStreaks);
    const svcB = new LessonProgressService(withoutLock(b.client) as any, noStreaks);
    await Promise.all([
      svcA.update(s.userId, s.p1, { is_completed: true } as any),
      svcB.update(s.userId, s.p2, { is_completed: true } as any),
    ]);
    const status = await svcA.findMyCourseProgress(s.userId, s.course);
    expect(status.is_completed).toBe(true); // course really is complete...
    expect(await completedAt(s.enrollmentId)).toBeNull(); // ...but no date was recorded
  });

  it('WITH the lock: two concurrent final-lesson completions record exactly one timestamp', async () => {
    const s = await setup();
    const svcA = new LessonProgressService(a.client as any, noStreaks);
    const svcB = new LessonProgressService(b.client as any, noStreaks);
    const started = Date.now();
    await Promise.all([
      svcA.update(s.userId, s.p1, { is_completed: true } as any),
      svcB.update(s.userId, s.p2, { is_completed: true } as any),
    ]);
    // the second transaction waited for the first one's lock (serialised)
    expect(Date.now() - started).toBeGreaterThanOrEqual(HOLD_MS);
    expect((await svcA.findMyCourseProgress(s.userId, s.course)).is_completed).toBe(true);
    const first = await completedAt(s.enrollmentId);
    expect(first).not.toBeNull();
    const changes = await audit(s.enrollmentId);
    expect(changes).toHaveLength(1);
    expect(changes[0].old_value).toBeNull();
  });

  it('concurrent duplicate and re-completions never overwrite the original date', async () => {
    const s = await setup();
    const svcA = new LessonProgressService(a.client as any, noStreaks);
    const svcB = new LessonProgressService(b.client as any, noStreaks);
    await Promise.all([
      svcA.update(s.userId, s.p1, { is_completed: true } as any),
      svcB.update(s.userId, s.p2, { is_completed: true } as any),
    ]);
    const first = await completedAt(s.enrollmentId);
    expect(first).not.toBeNull();

    // An admin adds a lesson; the learner's progress row for it exists.
    const l3 = s.course + 3n;
    await admin.$executeRawUnsafe(`INSERT INTO lessons (id, module_id, title, order_index) VALUES ($1, $2, 'L3', 3)`, l3, s.course);
    const p3 = (
      await admin.$queryRawUnsafe<{ id: bigint }[]>(
        `INSERT INTO lesson_progress (user_id, course_id, lesson_id, is_completed) VALUES ($1::uuid, $2, $3, false) RETURNING id`,
        s.userId, s.course, l3,
      )
    )[0].id;
    expect((await svcA.findMyCourseProgress(s.userId, s.course)).is_completed).toBe(false);

    // Two concurrent (duplicate) completions of the new lesson: both see it as
    // newly completed and both try to stamp.
    await sleep(1100);
    await Promise.all([
      svcA.update(s.userId, p3, { is_completed: true } as any),
      svcB.update(s.userId, p3, { is_completed: true } as any),
    ]);
    expect((await svcA.findMyCourseProgress(s.userId, s.course)).is_completed).toBe(true);
    expect(await completedAt(s.enrollmentId)).toEqual(first);
    expect(await audit(s.enrollmentId)).toHaveLength(1);
  });
});
