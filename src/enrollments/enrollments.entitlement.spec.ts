/**
 * B-2 service tests (2026-11-11). Test cases 8-12 of
 * _repair/BACKEND_STATUS_B2_PROPOSAL.md §4.5, plus findMyEnrollment and the
 * free-course renewal.
 *
 * The Prisma fakes deliberately IGNORE the status/expiry part of the query
 * filter and return whatever row exists for (user, course). That is the worst
 * case: it proves the code-level re-check rejects inactive rows even if the
 * database filter were wrong. The filter itself is checked in
 * enrollment-access.spec.ts and by asserting it is passed here.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await --
 * Prisma fakes are untyped by design. Test-only file. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';

import { CertificatesService } from '../certificates/certificates.service';
import { CouponsService } from '../coupons/coupons.service';
import { LessonProgressService } from '../lesson-progress/lesson-progress.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { ShippingRatesService } from '../shipping-rates/shipping-rates.service';
import { StorageService } from '../storage/storage.service';
import { StreaksService } from '../streaks/streaks.service';
import { activeEnrollmentWhere } from './enrollment-access';
import { EnrollmentsService } from './enrollments.service';

const DAY = 24 * 60 * 60 * 1000;
const past = () => new Date(Date.now() - DAY);
const future = () => new Date(Date.now() + 30 * DAY);

type Row = {
  id: string;
  user_id: string;
  course_id: bigint;
  payment_status: string;
  expires_at: Date | null;
  razorpay_order_id?: string | null;
};

function row(
  payment_status: string,
  expires_at: Date | null = null,
  user_id = 'user-1',
  course_id = 1n,
): Row {
  return { id: 'enr-1', user_id, course_id, payment_status, expires_at };
}

/** Permissive enrollments table: matches on (user, course) only. */
function enrollmentsTable(rows: Row[]) {
  const pick = (args: any) => {
    const w = args.where;
    const userId = w.user_id ?? w.user_id_course_id?.user_id;
    const courseId = w.course_id ?? w.user_id_course_id?.course_id;
    const r = rows.find(
      (x) => x.user_id === userId && x.course_id === courseId,
    );
    return r
      ? { ...r, courses: { id: r.course_id, thumbnail_url: null } }
      : null;
  };
  return {
    findFirst: jest.fn(async (args: any) => pick(args)),
    findUnique: jest.fn(async (args: any) => pick(args)),
    update: jest.fn(async (args: any) => ({ ...pick(args), ...args.data })),
    create: jest.fn(async (args: any) => ({ id: 'new', ...args.data })),
  };
}

const storage = {
  createSignedImageUrl: jest.fn(async () => null),
  createSignedPlaybackUrl: jest.fn(),
  uploadPdf: jest.fn(),
  deleteObject: jest.fn(),
};

// ── EnrollmentsService ──────────────────────────────────────────────────────
describe('B-2 EnrollmentsService', () => {
  async function make(rows: Row[], courses: any = {}) {
    const prisma: any = {
      enrollments: enrollmentsTable(rows),
      courses: { findUnique: jest.fn(async () => courses) },
    };
    const ref = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    return { service: ref.get(EnrollmentsService), prisma };
  }

  describe('findMyEnrollment', () => {
    it.each(['completed', 'paid', 'free', 'COMPLETED', 'Paid'])(
      'returns the enrollment for payment_status %p',
      async (status) => {
        const { service } = await make([row(status)]);
        await expect(
          service.findMyEnrollment('user-1', 1n),
        ).resolves.toMatchObject({
          payment_status: status,
        });
      },
    );

    it.each([
      'pending',
      'failed',
      'processing',
      'refunded',
      'cancelled',
      '',
      'unknown',
    ])('returns null for payment_status %p', async (status) => {
      const { service } = await make([row(status)]);
      await expect(service.findMyEnrollment('user-1', 1n)).resolves.toBeNull();
    });

    it('expiry not enforced (2026-11-12): returns the row for an expired AND a future expiry', async () => {
      const expired = await make([row('completed', past())]);
      await expect(
        expired.service.findMyEnrollment('user-1', 1n),
      ).resolves.not.toBeNull();
      const active = await make([row('completed', future())]);
      await expect(
        active.service.findMyEnrollment('user-1', 1n),
      ).resolves.not.toBeNull();
    });

    it("returns null for another user's enrollment", async () => {
      const { service } = await make([row('completed', null, 'someone-else')]);
      await expect(service.findMyEnrollment('user-1', 1n)).resolves.toBeNull();
    });

    it('passes the payment_status allow-list (and no expiry condition) to Prisma', async () => {
      const { service, prisma } = await make([row('completed')]);
      await service.findMyEnrollment('user-1', 1n);
      const where = prisma.enrollments.findFirst.mock.calls[0][0].where;
      const expected = activeEnrollmentWhere('user-1', 1n, new Date(0));
      expect(where.user_id).toBe(expected.user_id);
      expect(where.course_id).toBe(expected.course_id);
      expect((where.AND as any[])[0]).toEqual((expected.AND as any[])[0]);
      expect(where.AND as any[]).toHaveLength(1);
      expect(
        JSON.stringify(where, (_k, v: unknown) =>
          typeof v === 'bigint' ? v.toString() : v,
        ),
      ).not.toContain('expires_at');
    });
  });

  describe('createPaidEnrollment (renewal / re-purchase)', () => {
    // 10.
    it('expiry not enforced: an EXPIRED completed enrollment is still active and is left unchanged', async () => {
      const existing = row('completed', past());
      const { service, prisma } = await make([existing]);
      const result = await service.createPaidEnrollment(
        'user-1',
        1n,
        'order_new',
        prisma,
      );
      expect(prisma.enrollments.update).not.toHaveBeenCalled();
      expect(prisma.enrollments.create).not.toHaveBeenCalled();
      expect(result).toMatchObject(existing);
    });

    // 11.
    it.each(['pending', 'refunded', 'failed', 'paid'])(
      'turns a %p enrollment into completed with a fresh expiry',
      async (status) => {
        const { service, prisma } = await make([row(status, past())]);
        await service.createPaidEnrollment('user-1', 1n, 'order_new', prisma);
        expect(prisma.enrollments.update.mock.calls[0][0].data).toEqual({
          payment_status: 'completed',
          razorpay_order_id: 'order_new',
          expires_at: null,
        });
      },
    );

    it('leaves an ACTIVE completed enrollment unchanged (idempotent)', async () => {
      const { service, prisma } = await make([row('completed', future())]);
      const result = await service.createPaidEnrollment(
        'user-1',
        1n,
        'order_new',
        prisma,
      );
      expect(prisma.enrollments.update).not.toHaveBeenCalled();
      expect(result.payment_status).toBe('completed');
    });

    it('creates a new completed enrollment when none exists', async () => {
      const { service, prisma } = await make([]);
      await service.createPaidEnrollment('user-1', 1n, 'order_new', prisma);
      expect(prisma.enrollments.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-1',
          course_id: 1n,
          payment_status: 'completed',
          razorpay_order_id: 'order_new',
        },
      });
    });
  });

  describe('enrollInFreeCourse (renewal)', () => {
    const FREE = { id: 1n, is_free: true };

    it('expiry not enforced: an expired completed free enrollment still has access → 409 already enrolled', async () => {
      const { service, prisma } = await make([row('completed', past())], FREE);
      await expect(
        service.enrollInFreeCourse('user-1', 1n),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.enrollments.update).not.toHaveBeenCalled();
      expect(prisma.enrollments.create).not.toHaveBeenCalled();
    });

    it.each(['pending', 'failed', 'refunded'])(
      'renews an inactive (%p) free enrollment with a fresh (null) expiry',
      async (status) => {
        const { service, prisma } = await make([row(status)], FREE);
        await service.enrollInFreeCourse('user-1', 1n);
        expect(prisma.enrollments.update.mock.calls[0][0].data).toEqual({
          payment_status: 'completed',
          expires_at: null,
        });
        expect(prisma.enrollments.create).not.toHaveBeenCalled();
      },
    );

    it('still returns 409 for an active enrollment', async () => {
      const { service, prisma } = await make(
        [row('completed', future())],
        FREE,
      );
      await expect(
        service.enrollInFreeCourse('user-1', 1n),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.enrollments.update).not.toHaveBeenCalled();
    });

    it('still refuses a paid course', async () => {
      const { service } = await make([], { id: 1n, is_free: false });
      await expect(
        service.enrollInFreeCourse('user-1', 1n),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

// ── LessonProgressService (8) ───────────────────────────────────────────────
describe('B-2 lesson progress authorization', () => {
  const PASSED_GATE = new Error('passed the enrollment gate');

  async function make(rows: Row[]) {
    const prisma: any = {
      enrollments: enrollmentsTable(rows),
      // Reached only after verifyEnrollment succeeds.
      lessons: {
        findMany: jest.fn(async () => {
          throw PASSED_GATE;
        }),
        findUnique: jest.fn(async () => {
          throw PASSED_GATE;
        }),
      },
    };
    const ref = await Test.createTestingModule({
      providers: [
        LessonProgressService,
        { provide: PrismaService, useValue: prisma },
        { provide: StreaksService, useValue: {} },
      ],
    }).compile();
    return { service: ref.get(LessonProgressService), prisma };
  }

  it.each([
    ['pending', null],
    ['refunded', null],
    ['processing', null],
    ['', null],
    ['refunded', 'expired'],
  ])(
    'GET course progress: 403 for payment_status %p (%p)',
    async (status, exp) => {
      const { service } = await make([row(status, exp ? past() : null)]);
      await expect(
        service.findMyCourseProgress('user-1', 1n),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('POST progress: 403 for a refunded enrollment', async () => {
    const { service, prisma } = await make([row('refunded')]);
    await expect(
      service.create('user-1', { course_id: 1, lesson_id: 11 } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.lessons.findUnique).not.toHaveBeenCalled();
  });

  it('expiry not enforced: an EXPIRED completed enrollment passes the progress gate (GET and POST)', async () => {
    const get = await make([row('completed', past())]);
    await expect(get.service.findMyCourseProgress('user-1', 1n)).rejects.toBe(
      PASSED_GATE,
    );
    const post = await make([row('completed', past())]);
    await expect(
      post.service.create('user-1', { course_id: 1, lesson_id: 11 } as any),
    ).rejects.toBe(PASSED_GATE);
  });

  it('403 when there is no enrollment row', async () => {
    const { service } = await make([]);
    await expect(
      service.findMyCourseProgress('user-1', 1n),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['completed', 'PAID', 'free'])(
    'active %p enrollment passes the gate',
    async (status) => {
      const { service, prisma } = await make([row(status, future())]);
      await expect(service.findMyCourseProgress('user-1', 1n)).rejects.toBe(
        PASSED_GATE,
      );
      expect(
        prisma.enrollments.findFirst.mock.calls[0][0].where.AND,
      ).toBeDefined();
    },
  );
});

// ── CertificatesService (9) ─────────────────────────────────────────────────
describe('B-2 certificate authorization', () => {
  async function make(rows: Row[]) {
    const prisma: any = {
      enrollments: enrollmentsTable(rows),
      // Every lesson completed: only the entitlement can stop issuance.
      lessons: { findMany: jest.fn(async () => [{ id: 11n }, { id: 12n }]) },
      lesson_progress: {
        // The certificate query selects lesson_id + is_completed (only rows
        // for lessons currently in the course count).
        findMany: jest.fn(async () => [
          { lesson_id: 11n, is_completed: true },
          { lesson_id: 12n, is_completed: true },
        ]),
      },
      certificates: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async (args: any) => ({ id: 'cert-1', ...args.data })),
      },
    };
    const ref = await Test.createTestingModule({
      providers: [
        CertificatesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    return { service: ref.get(CertificatesService), prisma };
  }

  it.each([
    ['refunded', null],
    ['pending', null],
    ['failed', null],
    ['refunded', 'expired'],
  ])(
    'POST /certificates/me: 403 for %p (%p) even with every lesson completed',
    async (status, exp) => {
      const { service, prisma } = await make([
        row(status, exp ? past() : null),
      ]);
      await expect(
        service.createForStudent('user-1', { course_id: 1 } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.certificates.create).not.toHaveBeenCalled();
    },
  );

  it('issues the certificate for an active enrollment with every lesson completed', async () => {
    const { service, prisma } = await make([row('completed', future())]);
    await expect(
      service.createForStudent('user-1', { course_id: 1 } as any),
    ).resolves.toMatchObject({ user_id: 'user-1', course_id: 1n });
    expect(prisma.certificates.create).toHaveBeenCalledTimes(1);
  });

  it('expiry not enforced: issues the certificate for an EXPIRED completed enrollment', async () => {
    const { service, prisma } = await make([row('completed', past())]);
    await expect(
      service.createForStudent('user-1', { course_id: 1 } as any),
    ).resolves.toMatchObject({ user_id: 'user-1', course_id: 1n });
    expect(prisma.certificates.create).toHaveBeenCalledTimes(1);
  });
});

// ── PaymentsService re-purchase guard (12) ──────────────────────────────────
describe('B-2 course re-purchase guard (createRazorpayOrder)', () => {
  async function make(enrollment: Row | null, purchase: any = null) {
    const prisma: any = {
      courses: {
        findUnique: jest.fn(async () => ({
          id: 5n,
          title: 'Course',
          price: new Prisma.Decimal(100),
          gst_rate: new Prisma.Decimal(18),
          is_free: false,
          is_published: true,
        })),
      },
      enrollments: { findUnique: jest.fn(async () => enrollment) },
      course_purchases: { findUnique: jest.fn(async () => purchase) },
      payments: { create: jest.fn(async () => ({ id: 'pay-1' })) },
    };
    const config = {
      get: jest.fn((k: string) =>
        k === 'RAZORPAY_KEY_ID'
          ? 'test_key_id'
          : k === 'RAZORPAY_KEY_SECRET'
            ? 'test_key_secret'
            : undefined,
      ),
    };
    const ref = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: StorageService, useValue: storage },
        {
          provide: EnrollmentsService,
          useValue: { createPaidEnrollment: jest.fn() },
        },
        { provide: ProductsService, useValue: {} },
        { provide: CouponsService, useValue: {} },
        { provide: ShippingRatesService, useValue: {} },
      ],
    }).compile();
    const service = ref.get(PaymentsService);
    const ordersCreate = jest.fn(async () => ({
      id: 'order_x',
      amount: 11800,
      currency: 'INR',
    }));
    (service as any).razorpay = { orders: { create: ordersCreate } };
    return { service, ordersCreate };
  }

  const buy = (service: PaymentsService) =>
    service.createRazorpayOrder('user-1', {
      currency: 'INR',
      order_type: 'course',
      course_id: '5',
    });

  it('expiry not enforced: an EXPIRED completed enrollment still has access, so re-purchase is blocked', async () => {
    const { service, ordersCreate } = await make(
      row('completed', past(), 'user-1', 5n),
      {
        access_granted: true,
      },
    );
    await expect(buy(service)).rejects.toThrow(
      'You already have access to this course',
    );
    expect(ordersCreate).not.toHaveBeenCalled();
  });

  it('allows purchase when the enrollment is refunded or pending', async () => {
    for (const status of ['refunded', 'pending']) {
      const { service } = await make(row(status, null, 'user-1', 5n), {
        access_granted: true,
      });
      await expect(buy(service)).resolves.toMatchObject({
        razorpay_order_id: 'order_x',
      });
    }
  });

  it.each(['completed', 'PAID', 'free'])(
    'blocks purchase when an active %p enrollment exists',
    async (status) => {
      const { service, ordersCreate } = await make(
        row(status, future(), 'user-1', 5n),
      );
      await expect(buy(service)).rejects.toThrow(
        'You already have access to this course',
      );
      expect(ordersCreate).not.toHaveBeenCalled();
    },
  );

  it('still blocks when there is no enrollment row but an access-granted purchase (unchanged)', async () => {
    const { service } = await make(null, { access_granted: true });
    await expect(buy(service)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a first purchase', async () => {
    const { service } = await make(null, null);
    await expect(buy(service)).resolves.toMatchObject({
      razorpay_order_id: 'order_x',
    });
  });
});
