/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
// Prisma, Razorpay and the injected services are replaced with plain jest
// mocks (typed `any`), so the no-unsafe-* rules do not apply in this file.
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn(),
      fetch: jest.fn(),
      fetchPayments: jest.fn(),
    },
    payments: {
      fetch: jest.fn(),
    },
  }));
});

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { IncludedKitsService } from './included-kits.service';

const PURCHASE_ID = '123e4567-e89b-12d3-a456-426614174000';
const KEY = 'kit-claim-claim-1';
const RZP_ORDER = 'order_rzp_1';
const SECRET = 'test_key_secret';

const validDto = {
  coursePurchaseId: PURCHASE_ID,
  shippingAddressId: '5',
  idempotencyKey: KEY,
};

const kitItems = [
  {
    product_id: BigInt(7),
    quantity: 2,
    products: { title: 'Arduino Uno', weight_kg: 0.2, weight: 0.2 },
  },
];

const purchase = {
  id: PURCHASE_ID,
  user_id: 'user-1',
  access_granted: true,
  status: 'active',
  courses: {
    kits: { id: 'kit-1', status: 'active', kit_items: kitItems },
  },
};

const address = {
  id: BigInt(5),
  full_name: 'Student One',
  address_line1: '1 Main Road',
  address_line2: null,
  city: 'Hyderabad',
  state: 'Telangana',
  postal_code: '500002',
  phone: '9999999999',
};

/** Claim row exactly as course checkout creates it: pending, no order. */
const unclaimedRow = () => ({
  id: 'claim-1',
  status: 'pending',
  order_id: null,
  attempts: [],
});

/** Claim row after a paid-shipping claim was started with KEY. */
const startedRow = (status = 'pending') => ({
  id: 'claim-1',
  status,
  order_id: 'order-1',
  attempts: [
    {
      id: 'attempt-1',
      claim_id: 'claim-1',
      order_id: 'order-1',
      idempotency_key: KEY,
    },
  ],
});

const claimWithKit = (status = 'pending') => ({
  id: 'claim-1',
  user_id: 'user-1',
  order_id: 'order-1',
  status,
  kits: { kit_items: [{ product_id: BigInt(7), quantity: 2 }] },
});

function setup() {
  const echo = jest.fn(({ data }) => Promise.resolve(data));

  const prisma: any = {
    course_purchases: { findFirst: jest.fn().mockResolvedValue(null) },
    included_kit_claims: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: echo,
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    included_kit_claim_attempts: {
      create: jest.fn(({ data }) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
    orders: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(({ data }) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({}),
    },
    order_items: { create: jest.fn().mockResolvedValue({}) },
    payments: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    products: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: BigInt(7), stock_quantity: 10 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $queryRaw: jest
      .fn()
      .mockResolvedValue([{ id: 'claim-1', status: 'pending' }]),
  };
  // The transaction client is the same mock, so writes inside are visible.
  prisma.$transaction = jest.fn((fn: (tx: any) => unknown) => fn(prisma));

  const configService: any = {
    get: jest.fn(
      (key: string) =>
        ({
          RAZORPAY_KEY_ID: 'test_key_id',
          RAZORPAY_KEY_SECRET: SECRET,
          SHIPROCKET_PICKUP_POSTCODE: '500001',
        })[key],
    ),
  };
  const shippingAddressesService: any = {
    validateForKitCheckout: jest.fn().mockResolvedValue(address),
  };
  const shippingRatesService: any = {
    getShippingAmount: jest.fn().mockResolvedValue(85),
  };
  const storageService: any = {
    createSignedImageUrl: jest.fn().mockResolvedValue(null),
  };

  const service = new IncludedKitsService(
    prisma,
    configService,
    shippingAddressesService,
    shippingRatesService,
    storageService,
  );
  const razorpay = (service as any).razorpay;

  return {
    service,
    prisma,
    razorpay,
    shippingAddressesService,
    shippingRatesService,
  };
}

describe('IncludedKitsService.claim: input validation', () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => (t = setup()));

  it('rejects a request without an authenticated user', async () => {
    await expect(t.service.claim('', validDto)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(t.prisma.course_purchases.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an invalid course purchase ID', async () => {
    await expect(
      t.service.claim('user-1', {
        ...validDto,
        coursePurchaseId: 'invalid-id',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(t.prisma.course_purchases.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an invalid shipping address ID', async () => {
    await expect(
      t.service.claim('user-1', { ...validDto, shippingAddressId: 'abc' }),
    ).rejects.toThrow(BadRequestException);
    expect(t.prisma.course_purchases.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key that is too short', async () => {
    await expect(
      t.service.claim('user-1', { ...validDto, idempotencyKey: 'short' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an idempotency key that is too long', async () => {
    await expect(
      t.service.claim('user-1', {
        ...validDto,
        idempotencyKey: 'x'.repeat(129),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("looks up the authenticated user's eligible course purchase", async () => {
    await expect(t.service.claim('user-1', validDto)).rejects.toThrow(
      NotFoundException,
    );
    expect(t.prisma.course_purchases.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: PURCHASE_ID,
          user_id: 'user-1',
          access_granted: true,
          status: 'active',
        },
      }),
    );
  });
});

describe('IncludedKitsService.claim: new claims', () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
    t.prisma.course_purchases.findFirst.mockResolvedValue(purchase);
    t.razorpay.orders.create.mockResolvedValue({ id: RZP_ORDER });
  });

  it('starts the first claim on the pending row created at course purchase', async () => {
    t.prisma.included_kit_claims.findUnique.mockResolvedValue(unclaimedRow());

    const result = await t.service.claim('user-1', validDto);

    expect(result).toMatchObject({
      claimId: 'claim-1',
      paymentRequired: true,
      razorpayOrderId: RZP_ORDER,
      shippingAmount: '85.00',
    });
    expect(t.razorpay.orders.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 8500, currency: 'INR' }),
    );
    // The claim is only taken if it is still unclaimed.
    expect(t.prisma.included_kit_claims.updateMany).toHaveBeenCalledWith({
      where: { id: 'claim-1', status: 'pending', order_id: null },
      data: expect.objectContaining({
        status: 'pending',
        order_id: result.orderId,
      }),
    });
    expect(t.prisma.payments.create).toHaveBeenCalledTimes(1);
    // Paid shipping: stock is deducted at verification, not now.
    expect(t.prisma.products.updateMany).not.toHaveBeenCalled();
    // The order keeps the address id for recovery after a reload.
    expect(
      t.prisma.orders.create.mock.calls[0][0].data.shipping_address,
    ).toMatchObject({ id: '5' });
  });

  it('rejects the losing request when two first claims race', async () => {
    t.prisma.included_kit_claims.findUnique.mockResolvedValue(unclaimedRow());
    t.prisma.included_kit_claims.updateMany.mockResolvedValue({ count: 0 });

    await expect(t.service.claim('user-1', validDto)).rejects.toThrow(
      'This kit claim was started by another request',
    );
    expect(t.prisma.payments.create).not.toHaveBeenCalled();
  });

  it('rejects a new idempotency key when a payment order already exists', async () => {
    t.prisma.included_kit_claims.findUnique.mockResolvedValue(startedRow());

    await expect(
      t.service.claim('user-1', {
        ...validDto,
        idempotencyKey: 'different-key-456',
      }),
    ).rejects.toThrow('A payment for this included kit is already pending');
    expect(t.razorpay.orders.create).not.toHaveBeenCalled();
  });

  it('rejects a new claim when the kit is already fulfilled', async () => {
    t.prisma.included_kit_claims.findUnique.mockResolvedValue({
      ...startedRow('fulfilled'),
      attempts: [],
    });

    await expect(t.service.claim('user-1', validDto)).rejects.toThrow(
      ConflictException,
    );
    expect(t.razorpay.orders.create).not.toHaveBeenCalled();
  });

  it('fulfils immediately and deducts stock once when shipping is free', async () => {
    t.shippingRatesService.getShippingAmount.mockResolvedValue(0);

    const result = await t.service.claim('user-1', validDto);

    expect(result.paymentRequired).toBe(false);
    expect(t.razorpay.orders.create).not.toHaveBeenCalled();
    expect(t.prisma.products.updateMany).toHaveBeenCalledTimes(1);
    expect(t.prisma.products.updateMany).toHaveBeenCalledWith({
      where: { id: BigInt(7), stock_quantity: { gte: 2 } },
      data: { stock_quantity: { decrement: 2 } },
    });
    expect(t.prisma.included_kit_claims.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'fulfilled' }),
      }),
    );
  });

  it('skips stock deduction for unlimited (-1) products', async () => {
    t.shippingRatesService.getShippingAmount.mockResolvedValue(0);
    t.prisma.products.findUnique.mockResolvedValue({
      id: BigInt(7),
      stock_quantity: -1,
    });

    await t.service.claim('user-1', validDto);

    expect(t.prisma.products.updateMany).not.toHaveBeenCalled();
  });
});

describe('IncludedKitsService.claim: retry with the same idempotency key', () => {
  let t: ReturnType<typeof setup>;

  const unpaidOrder = {
    id: RZP_ORDER,
    status: 'created',
    amount: 8500,
    amount_paid: 0,
  };
  const paidOrder = {
    id: RZP_ORDER,
    status: 'paid',
    amount: 8500,
    amount_paid: 8500,
  };
  const capturedPayment = {
    id: 'pay_1',
    status: 'captured',
    order_id: RZP_ORDER,
    currency: 'INR',
    amount: 8500,
  };

  beforeEach(() => {
    t = setup();
    t.prisma.course_purchases.findFirst.mockResolvedValue(purchase);
    t.prisma.included_kit_claims.findUnique
      .mockResolvedValueOnce(startedRow())
      .mockResolvedValueOnce(claimWithKit());
    t.prisma.orders.findUnique.mockResolvedValue({
      id: 'order-1',
      total_amount: 85,
      status: 'pending',
      razorpay_order_id: RZP_ORDER,
      shipping_address: { id: '5' },
    });
    t.prisma.payments.findUnique.mockResolvedValue({
      id: 'pay-rec-1',
      amount: 85,
      status: 'pending',
    });
  });

  it('reuses the unpaid Razorpay order and creates nothing new', async () => {
    t.razorpay.orders.fetch.mockResolvedValue(unpaidOrder);
    t.razorpay.orders.fetchPayments.mockResolvedValue({ items: [] });

    const result = await t.service.claim('user-1', validDto);

    expect(result).toMatchObject({
      reused: true,
      paymentRequired: true,
      paymentCaptured: false,
      alreadyFulfilled: false,
      requiresReconciliation: false,
      razorpayOrderId: RZP_ORDER,
      razorpayKeyId: 'test_key_id',
      amount: 8500,
    });
    expect(t.razorpay.orders.create).not.toHaveBeenCalled();
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not re-validate the address on retry (it may have been deleted)', async () => {
    t.razorpay.orders.fetch.mockResolvedValue(unpaidOrder);
    t.razorpay.orders.fetchPayments.mockResolvedValue({ items: [] });

    await t.service.claim('user-1', validDto);

    expect(
      t.shippingAddressesService.validateForKitCheckout,
    ).not.toHaveBeenCalled();
  });

  it('fulfils a captured payment that was never verified (tab closed)', async () => {
    t.razorpay.orders.fetch.mockResolvedValue(paidOrder);
    t.razorpay.orders.fetchPayments.mockResolvedValue({
      items: [capturedPayment],
    });

    const result = await t.service.claim('user-1', validDto);

    expect(result).toMatchObject({
      paymentRequired: false,
      paymentCaptured: true,
      alreadyFulfilled: true,
      fulfilledNow: true,
      requiresReconciliation: false,
      razorpayOrderId: null,
    });
    expect(result).toMatchObject({ order: { status: 'pending_fulfillment' } });
    expect(t.prisma.products.updateMany).toHaveBeenCalledTimes(1);
    expect(t.prisma.payments.update).toHaveBeenCalledWith({
      where: { razorpay_order_id: RZP_ORDER },
      data: { razorpay_payment_id: 'pay_1', status: 'captured' },
    });
    expect(t.prisma.included_kit_claims.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'fulfilled' }),
      }),
    );
    expect(t.razorpay.orders.create).not.toHaveBeenCalled();
  });

  it('does not deduct stock again if another request fulfilled the claim first', async () => {
    t.razorpay.orders.fetch.mockResolvedValue(paidOrder);
    t.razorpay.orders.fetchPayments.mockResolvedValue({
      items: [capturedPayment],
    });
    t.prisma.$queryRaw.mockResolvedValue([
      { id: 'claim-1', status: 'fulfilled' },
    ]);

    const result = await t.service.claim('user-1', validDto);

    expect(result).toMatchObject({
      alreadyFulfilled: true,
      fulfilledNow: false,
    });
    expect(t.prisma.products.updateMany).not.toHaveBeenCalled();
  });

  it('asks for reconciliation when the payment is captured but stock is short', async () => {
    t.razorpay.orders.fetch.mockResolvedValue(paidOrder);
    t.razorpay.orders.fetchPayments.mockResolvedValue({
      items: [capturedPayment],
    });
    t.prisma.products.updateMany.mockResolvedValue({ count: 0 });

    const result = await t.service.claim('user-1', validDto);

    expect(result).toMatchObject({
      paymentRequired: false,
      paymentCaptured: true,
      alreadyFulfilled: false,
      requiresReconciliation: true,
    });
    expect(result.message).toContain('Insufficient stock');
    // The captured payment is still recorded outside the rolled-back transaction.
    expect(t.prisma.payments.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'captured' }),
      }),
    );
  });

  it('returns 409 and creates nothing when Razorpay cannot be reached', async () => {
    t.razorpay.orders.fetch.mockRejectedValue(new Error('network down'));

    await expect(t.service.claim('user-1', validDto)).rejects.toThrow(
      'No new payment order was created',
    );
    expect(t.razorpay.orders.create).not.toHaveBeenCalled();
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 409 when the Razorpay order amount does not match', async () => {
    t.razorpay.orders.fetch.mockResolvedValue({ ...unpaidOrder, amount: 9900 });
    t.razorpay.orders.fetchPayments.mockResolvedValue({ items: [] });

    await expect(t.service.claim('user-1', validDto)).rejects.toThrow(
      'does not match the expected amount',
    );
    expect(t.razorpay.orders.create).not.toHaveBeenCalled();
  });

  it('ignores a captured payment for a different amount', async () => {
    t.razorpay.orders.fetch.mockResolvedValue(paidOrder);
    t.razorpay.orders.fetchPayments.mockResolvedValue({
      items: [{ ...capturedPayment, amount: 100 }],
    });

    await expect(t.service.claim('user-1', validDto)).rejects.toThrow(
      ConflictException,
    );
    expect(t.prisma.products.updateMany).not.toHaveBeenCalled();
  });

  it('makes no Razorpay calls and no stock change for a fulfilled claim', async () => {
    t.prisma.included_kit_claims.findUnique.mockReset();
    t.prisma.included_kit_claims.findUnique.mockResolvedValue(
      startedRow('fulfilled'),
    );

    const result = await t.service.claim('user-1', validDto);

    expect(result).toMatchObject({
      alreadyFulfilled: true,
      paymentRequired: false,
      requiresReconciliation: false,
    });
    expect(t.razorpay.orders.fetch).not.toHaveBeenCalled();
    expect(t.prisma.products.updateMany).not.toHaveBeenCalled();
  });
});

describe('IncludedKitsService.verifyPayment', () => {
  let t: ReturnType<typeof setup>;
  const sign = (orderId: string, paymentId: string) =>
    createHmac('sha256', SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  const dto = {
    razorpay_order_id: RZP_ORDER,
    razorpay_payment_id: 'pay_1',
    razorpay_signature: sign(RZP_ORDER, 'pay_1'),
  };

  beforeEach(() => {
    t = setup();
    t.prisma.payments.findUnique.mockResolvedValue({
      id: 'pay-rec-1',
      user_id: 'user-1',
      razorpay_order_id: RZP_ORDER,
      amount: 85,
      currency: 'INR',
    });
    t.razorpay.payments.fetch.mockResolvedValue({
      id: 'pay_1',
      order_id: RZP_ORDER,
      status: 'captured',
      currency: 'INR',
      amount: 8500,
    });
    t.prisma.orders.findFirst.mockResolvedValue({
      id: 'order-1',
      user_id: 'user-1',
      order_type: 'included_kit',
      razorpay_order_id: RZP_ORDER,
    });
    t.prisma.included_kit_claims.findFirst.mockResolvedValue(claimWithKit());
    t.prisma.included_kit_claim_attempts.findUnique.mockResolvedValue({
      id: 'attempt-1',
    });
  });

  it('rejects verification when authentication is missing', async () => {
    await expect(t.service.verifyPayment('', dto)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an invalid payment signature before touching orders', async () => {
    await expect(
      t.service.verifyPayment('user-1', {
        ...dto,
        razorpay_signature: 'invalid_signature',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(t.prisma.orders.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a payment whose captured amount does not match', async () => {
    t.razorpay.payments.fetch.mockResolvedValue({
      id: 'pay_1',
      order_id: RZP_ORDER,
      status: 'captured',
      currency: 'INR',
      amount: 100,
    });

    await expect(t.service.verifyPayment('user-1', dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('verifies the payment and deducts stock exactly once', async () => {
    const result = await t.service.verifyPayment('user-1', dto);

    expect(result).toMatchObject({
      success: true,
      orderId: 'order-1',
      claimId: 'claim-1',
    });
    expect(t.prisma.products.updateMany).toHaveBeenCalledTimes(1);
    expect(t.prisma.payments.update).toHaveBeenCalledWith({
      where: { razorpay_order_id: RZP_ORDER },
      data: {
        razorpay_payment_id: 'pay_1',
        razorpay_signature: dto.razorpay_signature,
        status: 'captured',
      },
    });
    expect(t.prisma.orders.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending_fulfillment' }),
      }),
    );
  });

  it('does not deduct stock again for an already-fulfilled claim', async () => {
    t.prisma.included_kit_claims.findFirst.mockResolvedValue(
      claimWithKit('fulfilled'),
    );

    const result = await t.service.verifyPayment('user-1', dto);

    expect(result).toMatchObject({ success: true, alreadyFulfilled: true });
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
    expect(t.prisma.products.updateMany).not.toHaveBeenCalled();
  });

  it('does not deduct stock if a concurrent request fulfilled the claim first', async () => {
    t.prisma.$queryRaw.mockResolvedValue([
      { id: 'claim-1', status: 'fulfilled' },
    ]);

    const result = await t.service.verifyPayment('user-1', dto);

    expect(result).toMatchObject({ success: true, alreadyFulfilled: true });
    expect(t.prisma.products.updateMany).not.toHaveBeenCalled();
  });
});

describe('IncludedKitsService.findMine', () => {
  const claim = (
    id: string,
    status: string,
    order: null | {
      shipping_address: unknown;
      razorpay_order_id: string | null;
    },
  ) => ({
    id,
    status,
    course_purchase_id: PURCHASE_ID,
    course_purchases: {
      courses: { id: BigInt(45), title: 'Kit test course' },
    },
    kits: {
      id: 'kit-1',
      name: 'IOT',
      kit_items: [
        {
          quantity: 1,
          products: {
            id: BigInt(7),
            title: 'Arduino Uno',
            thumbnail_url: null,
            images: [],
          },
        },
      ],
    },
    orders: order && { id: `order-${id}`, status: 'pending', ...order },
    created_at: new Date('2026-11-11T00:00:00Z'),
  });

  it('returns shipping_address_id from the order snapshot, or null for older orders', async () => {
    const t = setup();
    t.prisma.included_kit_claims.findMany.mockResolvedValue([
      claim('new', 'pending', {
        shipping_address: { id: '5', city: 'Hyderabad' },
        razorpay_order_id: null,
      }),
      claim('old', 'pending', {
        shipping_address: { city: 'Hyderabad' },
        razorpay_order_id: null,
      }),
    ]);

    const [withId, withoutId] = await t.service.findMine('user-1');

    expect(withId.shipping_address_id).toBe('5');
    expect(withoutId.shipping_address_id).toBeNull();
    expect(withId.course).toEqual({ id: '45', title: 'Kit test course' });
  });

  it('returns payment_status for each claim from one payments query', async () => {
    const t = setup();
    const address = { id: '5' };
    t.prisma.included_kit_claims.findMany.mockResolvedValue([
      claim('unclaimed', 'pending', null),
      claim('free', 'fulfilled', {
        shipping_address: address,
        razorpay_order_id: null,
      }),
      claim('unpaid', 'pending', {
        shipping_address: address,
        razorpay_order_id: 'order_a',
      }),
      claim('paid', 'pending', {
        shipping_address: address,
        razorpay_order_id: 'order_b',
      }),
      claim('failed', 'pending', {
        shipping_address: address,
        razorpay_order_id: 'order_c',
      }),
      claim('norow', 'pending', {
        shipping_address: address,
        razorpay_order_id: 'order_d',
      }),
    ]);
    t.prisma.payments.findMany.mockResolvedValue([
      { razorpay_order_id: 'order_a', status: 'pending' },
      { razorpay_order_id: 'order_b', status: 'captured' },
      { razorpay_order_id: 'order_c', status: 'failed' },
    ]);

    const result = await t.service.findMine('user-1');

    expect(result.map((c) => [c.id, c.payment_status])).toEqual([
      ['unclaimed', null],
      ['free', 'not_required'],
      ['unpaid', 'pending'],
      ['paid', 'captured'],
      ['failed', 'failed'],
      ['norow', 'pending'],
    ]);
    expect(t.prisma.payments.findMany).toHaveBeenCalledTimes(1);
    expect(t.prisma.payments.findMany).toHaveBeenCalledWith({
      where: {
        razorpay_order_id: { in: ['order_a', 'order_b', 'order_c', 'order_d'] },
      },
      select: { razorpay_order_id: true, status: true },
    });
  });

  it('skips the payments query when no claim has a Razorpay order', async () => {
    const t = setup();
    t.prisma.included_kit_claims.findMany.mockResolvedValue([
      claim('unclaimed', 'pending', null),
    ]);

    const [only] = await t.service.findMine('user-1');

    expect(only.payment_status).toBeNull();
    expect(only.order).toBeNull();
    expect(t.prisma.payments.findMany).not.toHaveBeenCalled();
  });
});
