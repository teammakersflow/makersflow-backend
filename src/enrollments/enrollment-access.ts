import { Prisma } from '@prisma/client';

/**
 * B-2 (2026-11-11): the single course-entitlement rule for NestJS.
 *
 * An enrollment grants access when:
 *   1. payment_status is one of ACCESS_PAYMENT_STATUSES (case-insensitive).
 *      This is an allow-list: pending, failed, processing, refunded,
 *      cancelled, empty and any unknown value never grant access.
 *   2. ONLY when ENROLLMENT_EXPIRY_ENFORCED is true: expires_at is null (no
 *      expiry) or strictly in the future.
 *
 * Same rule as the mobile app (lib/courseAccess.ts), which has the same
 * ENFORCE_ENROLLMENT_EXPIRY switch. The separate `status` column is not used:
 * it is not part of the Prisma schema.
 *
 * An enrollment row is required for every course, free ones included.
 */
export const ACCESS_PAYMENT_STATUSES = ['completed', 'paid', 'free'] as const;

/**
 * Owner decision 2026-11-12: do NOT enforce the one-year `expires_at` yet.
 *
 * Production enrollments carry 1-year expiry dates (Supabase baseline
 * backfill, Supabase course fulfilment and admin manual grants), while this
 * backend never enforced them. Enforcing now would cut off students enrolled
 * more than a year ago before they can be measured and notified. Expiry is
 * therefore ignored for course, lesson, video, quiz, certificate and progress
 * access. Turn this on only together with the mobile switch
 * (artifacts/mobile/lib/courseAccess.ts ENFORCE_ENROLLMENT_EXPIRY) and a
 * renewal/notification plan.
 */
export const ENROLLMENT_EXPIRY_ENFORCED = false;

export interface EnrollmentAccessFields {
  payment_status?: string | null;
  expires_at?: Date | string | null;
}

export interface EnrollmentAccessOptions {
  /** Defaults to ENROLLMENT_EXPIRY_ENFORCED. */
  enforceExpiry?: boolean;
}

/** True when the enrollment row grants access at `now`. */
export function isEnrollmentActive(
  enrollment: EnrollmentAccessFields | null | undefined,
  now: Date = new Date(),
  { enforceExpiry = ENROLLMENT_EXPIRY_ENFORCED }: EnrollmentAccessOptions = {},
): boolean {
  if (!enrollment) return false;

  const status =
    typeof enrollment.payment_status === 'string'
      ? enrollment.payment_status.toLowerCase()
      : '';
  if (!(ACCESS_PAYMENT_STATUSES as readonly string[]).includes(status)) {
    return false;
  }

  if (!enforceExpiry) return true;

  if (enrollment.expires_at === null || enrollment.expires_at === undefined) {
    return true;
  }
  const expiresAt = new Date(enrollment.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

/** Prisma filter for an active enrollment of `userId` in `courseId` at `now`. */
export function activeEnrollmentWhere(
  userId: string,
  courseId: bigint,
  now: Date = new Date(),
  { enforceExpiry = ENROLLMENT_EXPIRY_ENFORCED }: EnrollmentAccessOptions = {},
): Prisma.enrollmentsWhereInput {
  const conditions: Prisma.enrollmentsWhereInput[] = [
    {
      OR: ACCESS_PAYMENT_STATUSES.map((status) => ({
        payment_status: {
          equals: status,
          mode: Prisma.QueryMode.insensitive,
        },
      })),
    },
  ];
  if (enforceExpiry) {
    conditions.push({
      OR: [{ expires_at: null }, { expires_at: { gt: now } }],
    });
  }
  return {
    user_id: userId,
    course_id: courseId,
    AND: conditions,
  };
}
