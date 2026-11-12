/**
 * B-2 unit tests (2026-11-11): the shared entitlement rule.
 * Covers test cases 1-7 of _repair/BACKEND_STATUS_B2_PROPOSAL.md §4.5.
 */
import { Prisma } from '@prisma/client';
import {
  ACCESS_PAYMENT_STATUSES,
  ENROLLMENT_EXPIRY_ENFORCED,
  activeEnrollmentWhere,
  isEnrollmentActive,
} from './enrollment-access';

const NOW = new Date('2026-11-11T12:00:00.000Z');
const PAST = new Date('2026-11-10T12:00:00.000Z');
const FUTURE = new Date('2026-12-11T12:00:00.000Z');
/** The expiry rule, kept for when it is switched on again. */
const ENFORCED = { enforceExpiry: true };

describe('B-2 expiry policy (owner decision 2026-11-12: not enforced yet)', () => {
  it('expiry is not enforced by default', () => {
    expect(ENROLLMENT_EXPIRY_ENFORCED).toBe(false);
  });

  it('an expired enrollment with an allowed payment_status keeps access', () => {
    expect(
      isEnrollmentActive(
        { payment_status: 'completed', expires_at: PAST },
        NOW,
      ),
    ).toBe(true);
    expect(
      isEnrollmentActive(
        { payment_status: 'free', expires_at: '2020-01-01T00:00:00Z' },
        NOW,
      ),
    ).toBe(true);
    expect(
      isEnrollmentActive({ payment_status: 'PAID', expires_at: NOW }, NOW),
    ).toBe(true);
  });

  it('the payment_status allow-list is still enforced regardless of expiry', () => {
    for (const status of [
      'pending',
      'failed',
      'refunded',
      'cancelled',
      'success',
      '',
    ]) {
      expect(
        isEnrollmentActive({ payment_status: status, expires_at: FUTURE }, NOW),
      ).toBe(false);
      expect(
        isEnrollmentActive({ payment_status: status, expires_at: null }, NOW),
      ).toBe(false);
    }
    expect(
      isEnrollmentActive({ payment_status: null, expires_at: FUTURE }, NOW),
    ).toBe(false);
    expect(isEnrollmentActive(null, NOW)).toBe(false);
  });

  it('the Prisma filter has no expiry condition by default', () => {
    const where = activeEnrollmentWhere('user-1', 7n, NOW);
    const and = where.AND as Prisma.enrollmentsWhereInput[];
    expect(and).toHaveLength(1);
    expect(
      JSON.stringify(where, (_k, v: unknown) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    ).not.toContain('expires_at');
  });
});

describe('B-2 isEnrollmentActive', () => {
  // 1. allowed statuses
  it.each(['completed', 'paid', 'free'])(
    'grants access for payment_status %p with no expiry',
    (status) => {
      expect(isEnrollmentActive({ payment_status: status }, NOW)).toBe(true);
    },
  );

  // 2. case-insensitive
  it.each(['COMPLETED', 'Completed', 'PAID', 'Paid', 'FREE', 'fReE'])(
    'grants access for %p (case-insensitive)',
    (status) => {
      expect(isEnrollmentActive({ payment_status: status }, NOW)).toBe(true);
    },
  );

  // 3. rejected statuses
  it.each([
    'pending',
    'failed',
    'processing',
    'refunded',
    'cancelled',
    'canceled',
    '',
    ' completed',
    'completed ',
    'success',
    'captured',
    'authorized',
    'weird',
  ])('denies access for payment_status %p', (status) => {
    expect(isEnrollmentActive({ payment_status: status }, NOW)).toBe(false);
  });

  it('denies access for null / undefined payment_status', () => {
    expect(isEnrollmentActive({ payment_status: null }, NOW)).toBe(false);
    expect(isEnrollmentActive({}, NOW)).toBe(false);
  });

  it('denies access when there is no enrollment', () => {
    expect(isEnrollmentActive(null, NOW)).toBe(false);
    expect(isEnrollmentActive(undefined, NOW)).toBe(false);
  });

  // 4–6. Expiry rule WHEN ENFORCED (switched off for now; kept tested).
  it('[enforced] denies access when expires_at is in the past', () => {
    expect(
      isEnrollmentActive(
        { payment_status: 'completed', expires_at: PAST },
        NOW,
        ENFORCED,
      ),
    ).toBe(false);
  });

  it('[enforced] denies access one second after expiry and at the exact expiry instant', () => {
    expect(
      isEnrollmentActive(
        {
          payment_status: 'completed',
          expires_at: new Date(NOW.getTime() - 1000),
        },
        NOW,
        ENFORCED,
      ),
    ).toBe(false);
    expect(
      isEnrollmentActive(
        { payment_status: 'completed', expires_at: NOW },
        NOW,
        ENFORCED,
      ),
    ).toBe(false);
  });

  it('[enforced] grants access one second before expiry and for a future expiry', () => {
    expect(
      isEnrollmentActive(
        {
          payment_status: 'completed',
          expires_at: new Date(NOW.getTime() + 1000),
        },
        NOW,
        ENFORCED,
      ),
    ).toBe(true);
    expect(
      isEnrollmentActive(
        { payment_status: 'paid', expires_at: FUTURE },
        NOW,
        ENFORCED,
      ),
    ).toBe(true);
  });

  it('[enforced] accepts ISO strings for expires_at and rejects an unparseable one', () => {
    expect(
      isEnrollmentActive(
        { payment_status: 'completed', expires_at: FUTURE.toISOString() },
        NOW,
        ENFORCED,
      ),
    ).toBe(true);
    expect(
      isEnrollmentActive(
        { payment_status: 'completed', expires_at: PAST.toISOString() },
        NOW,
        ENFORCED,
      ),
    ).toBe(false);
    expect(
      isEnrollmentActive(
        { payment_status: 'completed', expires_at: 'not-a-date' },
        NOW,
        ENFORCED,
      ),
    ).toBe(false);
  });

  it('grants access when expires_at is null (enforced or not)', () => {
    expect(
      isEnrollmentActive({ payment_status: 'free', expires_at: null }, NOW),
    ).toBe(true);
    expect(
      isEnrollmentActive(
        { payment_status: 'free', expires_at: null },
        NOW,
        ENFORCED,
      ),
    ).toBe(true);
  });

  it('[enforced] a valid status never rescues an expired enrollment, and a future expiry never rescues a bad status', () => {
    expect(
      isEnrollmentActive(
        { payment_status: 'PAID', expires_at: PAST },
        NOW,
        ENFORCED,
      ),
    ).toBe(false);
    expect(
      isEnrollmentActive(
        { payment_status: 'refunded', expires_at: FUTURE },
        NOW,
        ENFORCED,
      ),
    ).toBe(false);
  });
});

describe('B-2 activeEnrollmentWhere (query filter sent to Prisma)', () => {
  const where = activeEnrollmentWhere('user-1', 7n, NOW);

  // 7. scoped to the caller and the course
  it('is scoped to the given user and course only', () => {
    expect(where.user_id).toBe('user-1');
    expect(where.course_id).toBe(7n);
  });

  it('uses an allow-list of exactly completed/paid/free, case-insensitive', () => {
    expect(ACCESS_PAYMENT_STATUSES).toEqual(['completed', 'paid', 'free']);
    const and = where.AND as Prisma.enrollmentsWhereInput[];
    expect(and[0]).toEqual({
      OR: [
        {
          payment_status: {
            equals: 'completed',
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          payment_status: {
            equals: 'paid',
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          payment_status: {
            equals: 'free',
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    });
    // never a deny-list
    expect(
      JSON.stringify(where, (_k, v: unknown) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    ).not.toContain('notIn');
  });

  it('[enforced] requires expires_at to be null or after now', () => {
    const enforced = activeEnrollmentWhere('user-1', 7n, NOW, ENFORCED);
    const and = enforced.AND as Prisma.enrollmentsWhereInput[];
    expect(and[1]).toEqual({
      OR: [{ expires_at: null }, { expires_at: { gt: NOW } }],
    });
  });
});
