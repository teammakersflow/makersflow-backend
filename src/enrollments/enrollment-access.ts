import { Prisma } from '@prisma/client';

/**
 * B-2 (2026-11-11): the single course-entitlement rule for NestJS.
 *
 * An enrollment grants access only when BOTH hold:
 *   1. payment_status is one of ACCESS_PAYMENT_STATUSES (case-insensitive).
 *      This is an allow-list: pending, failed, processing, refunded,
 *      cancelled, empty and any unknown value never grant access.
 *   2. expires_at is null (no expiry) or strictly in the future.
 *
 * Same rule as the mobile app (lib/courseAccess.ts) and the Supabase
 * can_access_course() function, except that the separate `status` column is
 * not used: it is not part of the Prisma schema.
 *
 * An enrollment row is required for every course, free ones included.
 */
export const ACCESS_PAYMENT_STATUSES = ['completed', 'paid', 'free'] as const;

export interface EnrollmentAccessFields {
  payment_status?: string | null;
  expires_at?: Date | string | null;
}

/** True when the enrollment row grants access at `now`. */
export function isEnrollmentActive(
  enrollment: EnrollmentAccessFields | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!enrollment) return false;

  const status =
    typeof enrollment.payment_status === 'string'
      ? enrollment.payment_status.toLowerCase()
      : '';
  if (!(ACCESS_PAYMENT_STATUSES as readonly string[]).includes(status)) {
    return false;
  }

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
): Prisma.enrollmentsWhereInput {
  return {
    user_id: userId,
    course_id: courseId,
    AND: [
      {
        OR: ACCESS_PAYMENT_STATUSES.map((status) => ({
          payment_status: {
            equals: status,
            mode: Prisma.QueryMode.insensitive,
          },
        })),
      },
      {
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
    ],
  };
}
