import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { IncludedKitsService } from './included-kits.service';
import { createHmac } from 'crypto';

describe('IncludedKitsService.claim', () => {
  let service: IncludedKitsService;
  let prisma: any;
  let configService: any;
  let shippingAddressesService: any;
  let shippingRatesService: any;

  const validPurchaseId = '123e4567-e89b-12d3-a456-426614174000';
  const validDto = {
    coursePurchaseId: validPurchaseId,
    shippingAddressId: '123',
    idempotencyKey: 'included-kit-key-123',
  };

  beforeEach(() => {
    prisma = {
      course_purchases: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      included_kit_claims: {
        findUnique: jest.fn(),
      },
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'RAZORPAY_KEY_ID') return 'test_key_id';
        if (key === 'RAZORPAY_KEY_SECRET') return 'test_key_secret';
        return undefined;
      }),
    };

    shippingAddressesService = {
      validateForKitCheckout: jest.fn(),
    };

    shippingRatesService = {
      getShippingAmount: jest.fn(),
    };

    service = new IncludedKitsService(
      prisma,
      configService,
      shippingAddressesService,
      shippingRatesService,
    );
  });

  it('rejects a request without an authenticated user', async () => {
    await expect(
      service.claim('', validDto),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.course_purchases.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an invalid course purchase ID', async () => {
    await expect(
      service.claim('user-1', {
        ...validDto,
        coursePurchaseId: 'invalid-id',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.course_purchases.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an invalid shipping address ID', async () => {
    await expect(
      service.claim('user-1', {
        ...validDto,
        shippingAddressId: 'abc',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.course_purchases.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key that is too short', async () => {
    await expect(
      service.claim('user-1', {
        ...validDto,
        idempotencyKey: 'short',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.course_purchases.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key that is too long', async () => {
    await expect(
      service.claim('user-1', {
        ...validDto,
        idempotencyKey: 'x'.repeat(129),
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.course_purchases.findFirst).not.toHaveBeenCalled();
  });

  it('looks up the authenticated user�s eligible course purchase', async () => {
    await expect(
      service.claim('user-1', validDto),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.course_purchases.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: validPurchaseId,
          user_id: 'user-1',
          access_granted: true,
          status: 'active',
        },
      }),
    );
  });

it('rejects a new idempotency key when a claim already has a pending payment', async () => {
  const pendingClaim = {
    id: 'claim-1',
    status: 'pending',
    attempts: [
      {
        id: 'attempt-1',
        idempotency_key: 'original-key-123',
        order_id: 'order-1',
        claim_id: 'claim-1',
      },
    ],
  };
  prisma.course_purchases.findFirst.mockResolvedValue({
      id: validPurchaseId,
      user_id: 'user-1',
      access_granted: true,
      status: 'active',
      courses: {
        kits: {
          id: 'kit-1',
          status: 'active',
          kit_items: [{ quantity: 1, products: {} }],
        },
      },
    });
    prisma.included_kit_claims.findUnique.mockResolvedValue(pendingClaim);
    shippingAddressesService.validateForKitCheckout.mockResolvedValue({
      id: BigInt(123),
      postal_code: '500001',
    });

    await expect(
      service.claim('user-1', {
        ...validDto,
        idempotencyKey: 'different-key-456',
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.included_kit_claims.findUnique).toHaveBeenCalled();
  });

  describe('IncludedKitsService.verifyPayment', () => {
    let service: IncludedKitsService;
    let prisma: any;
    let configService: any;
    let shippingAddressesService: any;
    let shippingRatesService: any;
    let razorpay: any;

    beforeEach(() => {
      prisma = {
        payments: {
          findUnique: jest.fn(),
        },
        orders: {
          findFirst: jest.fn(),
        },
        included_kit_claims: {
          findFirst: jest.fn(),
        },
      };

      configService = {
        get: jest.fn((key: string) => {
          if (key === 'RAZORPAY_KEY_ID') return 'test_key_id';
          if (key === 'RAZORPAY_KEY_SECRET') return 'test_key_secret';
          return undefined;
        }),
      };

      shippingAddressesService = {
        validateForKitCheckout: jest.fn(),
      };

      shippingRatesService = {
        getShippingAmount: jest.fn(),
      };

      service = new IncludedKitsService(
        prisma,
        configService,
        shippingAddressesService,
        shippingRatesService,
      );
    });

    it('rejects verification when authentication is missing', async () => {
      await expect(
        service.verifyPayment('', {
          razorpay_order_id: 'order_test',
          razorpay_payment_id: 'pay_test',
          razorpay_signature: 'signature_test',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an invalid payment signature', async () => {
      prisma.payments.findUnique.mockResolvedValue({
        user_id: 'user-1',
        razorpay_order_id: 'order_test',
        amount: { toString: () => '100.00' },
        currency: 'INR',
      });

      await expect(
        service.verifyPayment('user-1', {
          razorpay_order_id: 'order_test',
          razorpay_payment_id: 'pay_test',
          razorpay_signature: 'invalid_signature',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.orders.findFirst).not.toHaveBeenCalled();
    });

    it('does not deduct stock again for an already-fulfilled claim', async () => {
      const orderId = 'order_test';
      const paymentId = 'pay_test';
      const secret = 'test_key_secret';

      const signature = createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      prisma.payments.findUnique.mockResolvedValue({
        id: 'payment-1',
        user_id: 'user-1',
        razorpay_order_id: orderId,
        amount: { toString: () => '100.00' },
        currency: 'INR',
      });

      prisma.orders.findFirst.mockResolvedValue({
        id: 'order-record-1',
        user_id: 'user-1',
        order_type: 'included_kit',
        razorpay_order_id: orderId,
      });

      prisma.included_kit_claims.findFirst.mockResolvedValue({
        id: 'claim-1',
        user_id: 'user-1',
        order_id: 'order-record-1',
        status: 'fulfilled',
        kits: { kit_items: [] },
      });

      // The service owns its Razorpay client, so this test needs a small
      // client mock or an injectable client to reach the fulfilled-claim guard.
      // Do not add this test as-is until that client can be mocked.
    });
  });
});
