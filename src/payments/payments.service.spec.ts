import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { ProductsService } from '../products/products.service';
import { CouponsService } from '../coupons/coupons.service';
import { ShippingRatesService } from '../shipping-rates/shipping-rates.service';
import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const razorpayOrdersCreateMock = jest.fn();
  const razorpayOrdersFetchMock = jest.fn();
  const razorpayPaymentsFetchMock = jest.fn();

  const storageMock = {
    uploadPdf: jest.fn(),
    deleteObject: jest.fn(),
  };

  const enrollmentsMock = {
    createPaidEnrollment: jest.fn(),
  };

  const productsServiceMock = {
    deductStock: jest.fn(),
  };

  const txMock = {
    orders: { create: jest.fn() },
    order_items: { createMany: jest.fn() },
    invoices: { create: jest.fn() },
    course_purchases: { upsert: jest.fn() },
    payments: { update: jest.fn() },
  };

  const prismaMock = {
    products: { findMany: jest.fn() },
    courses: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    course_purchases: { findUnique: jest.fn() },
    enrollments: { findFirst: jest.fn() },
    payments: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    orders: { findFirst: jest.fn() },
    invoices: { findUnique: jest.fn() },
    $transaction: jest.fn(
      async (callback: (tx: any) => Promise<any>) => callback(txMock),
    ),
  };

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'RAZORPAY_KEY_ID') {
        return 'test_key_id';
      }

      if (key === 'RAZORPAY_KEY_SECRET') {
        return 'test_key_secret';
      }

      if (key === 'SHIPROCKET_PICKUP_POSTCODE') {
        return '500001';
      }

      return undefined;
    }),
  };

  const couponsMock = {
    validate: jest.fn(),
  };

  const shippingRatesMock = {
    getShippingAmount: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,

        {
          provide: PrismaService,
          useValue: prismaMock,
        },

        {
          provide: ConfigService,
          useValue: configMock,
        },

        {
          provide: StorageService,
          useValue: storageMock,
        },

        {
          provide: EnrollmentsService,
          useValue: enrollmentsMock,
        },

        {
          provide: ProductsService,
          useValue: productsServiceMock,
        },

        {
          provide: CouponsService,
          useValue: couponsMock,
        },

        {
          provide: ShippingRatesService,
          useValue: shippingRatesMock,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    (service as any).razorpay = {
      orders: {
        create: razorpayOrdersCreateMock,
        fetch: razorpayOrdersFetchMock,
      },
      payments: {
        fetch: razorpayPaymentsFetchMock,
      },
    };
    razorpayOrdersCreateMock.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate payment amount using database price, tax and shipping', async () => {
    prismaMock.products.findMany.mockResolvedValue([
      {
        id: BigInt(23),
        title: 'sensor',
        price: new Prisma.Decimal(50),
        gst_rate: new Prisma.Decimal(18),
        status: 'active',
        in_stock: true,
        is_course: false,
        weight: new Prisma.Decimal(0.5),
        weight_kg: new Prisma.Decimal(0.5),
      },
    ]);

    shippingRatesMock.getShippingAmount.mockResolvedValue(83.16);

    prismaMock.payments.create.mockResolvedValue({
      id: 'payment-test-id',
    });

    razorpayOrdersCreateMock.mockResolvedValue({
      id: 'order_test_123',
    });

    const result = await service.createRazorpayOrder('user-test-id', {
      currency: 'INR',
      items: [
        {
          productId: '23',
          quantity: 1,
        },
      ],
      shipping_address: {
        pincode: '500001',
      },
      order_type: 'product',
    });

    expect(result.pricing.subtotal).toBe('50.00');
    expect(result.pricing.tax_amount).toBe('9.00');
    expect(result.pricing.shipping_amount).toBe('83.16');
    expect(result.pricing.discount_amount).toBe('0.00');
    expect(result.pricing.total_amount).toBe('142.16');

    expect(razorpayOrdersCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 14216,
        currency: 'INR',
      }),
    );

    expect(prismaMock.payments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: new Prisma.Decimal('142.16'),
          currency: 'INR',
          status: 'pending',
        }),
      }),
    );
  });

  it('should ignore frontend-submitted amount and use server-calculated total', async () => {
    prismaMock.products.findMany.mockResolvedValue([
      {
        id: BigInt(23),
        title: 'sensor',
        price: new Prisma.Decimal(50),
        gst_rate: new Prisma.Decimal(18),
        status: 'active',
        in_stock: true,
        is_course: false,
        weight: new Prisma.Decimal(0.5),
        weight_kg: new Prisma.Decimal(0.5),
      },
    ]);

    shippingRatesMock.getShippingAmount.mockResolvedValue(83.16);

    prismaMock.payments.create.mockResolvedValue({
      id: 'payment-tampered-test',
    });

    razorpayOrdersCreateMock.mockResolvedValue({
      id: 'order_tampered_test',
    });

    await service.createRazorpayOrder('user-test-id', {
      amount: 1,
      currency: 'INR',
      items: [
        {
          productId: '23',
          quantity: 1,
        },
      ],
      shipping_address: {
        pincode: '500001',
      },
      order_type: 'product',
    });

    expect(razorpayOrdersCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 14216,
        currency: 'INR',
      }),
    );

    expect(razorpayOrdersCreateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1,
      }),
    );
  });

  it('should reject a product that does not exist', async () => {
    prismaMock.products.findMany.mockResolvedValue([]);

    await expect(
      service.createRazorpayOrder('user-test-id', {
        currency: 'INR',
        items: [
          {
            productId: '999999',
            quantity: 1,
          },
        ],
        shipping_address: {
          pincode: '500001',
        },
        order_type: 'product',
      }),
    ).rejects.toThrow('One or more products were not found');

    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
  });

  it('should reject zero or negative quantity', async () => {
    prismaMock.products.findMany.mockResolvedValue([
      {
        id: '23',
        title: 'sensor',
        price: new Prisma.Decimal(50),
        gst_rate: new Prisma.Decimal(18),
        status: 'active',
        in_stock: true,
        stock_quantity: 10,
        is_course: false,
        weight: new Prisma.Decimal(0.5),
        weight_kg: new Prisma.Decimal(0.5),
      },
    ]);

    await expect(
      service.createRazorpayOrder('user-test-id', {
        currency: 'INR',
        items: [
          {
            productId: '23',
            quantity: 0,
          },
        ],
        shipping_address: {
          pincode: '500001',
        },
        order_type: 'product',
      }),
    ).rejects.toThrow();

    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
  });

  it('should reject an out-of-stock product', async () => {
    prismaMock.products.findMany.mockResolvedValue([
      {
        id: '23',
        title: 'sensor',
        price: new Prisma.Decimal(50),
        gst_rate: new Prisma.Decimal(18),
        status: 'active',
        in_stock: false,
        stock_quantity: 0,
        is_course: false,
        weight: new Prisma.Decimal(0.5),
        weight_kg: new Prisma.Decimal(0.5),
      },
    ]);

    await expect(
      service.createRazorpayOrder('user-test-id', {
        currency: 'INR',
        items: [
          {
            productId: '23',
            quantity: 1,
          },
        ],
        shipping_address: {
          pincode: '500001',
        },
        order_type: 'product',
      }),
    ).rejects.toThrow();

    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
  });

  it('should reject quantity greater than available stock', async () => {
    prismaMock.products.findMany.mockResolvedValue([
      {
        id: '23',
        title: 'sensor',
        price: new Prisma.Decimal(50),
        gst_rate: new Prisma.Decimal(18),
        status: 'active',
        in_stock: true,
        stock_quantity: 2,
        is_course: false,
        weight: new Prisma.Decimal(0.5),
        weight_kg: new Prisma.Decimal(0.5),
      },
    ]);

    await expect(
      service.createRazorpayOrder('user-test-id', {
        currency: 'INR',
        items: [
          {
            productId: '23',
            quantity: 3,
          },
        ],
        shipping_address: {
          pincode: '500001',
        },
        order_type: 'product',
      }),
    ).rejects.toThrow();

    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
  });

  it('should apply a valid coupon discount to the server-calculated total', async () => {
    prismaMock.products.findMany.mockResolvedValue([
      {
        id: '23',
        title: 'sensor',
        price: new Prisma.Decimal(50),
        gst_rate: new Prisma.Decimal(18),
        status: 'active',
        in_stock: true,
        stock_quantity: 10,
        is_course: false,
        weight: new Prisma.Decimal(0.5),
        weight_kg: new Prisma.Decimal(0.5),
      },
    ]);

    shippingRatesMock.getShippingAmount.mockResolvedValue(83.16);

    couponsMock.validate.mockResolvedValue({
      valid: true,
      coupon_id: 'coupon-test-id',
      code: 'TEST10',
      discount_amount: 5.9,
      final_amount: 53.1,
    });

    prismaMock.payments.create.mockResolvedValue({
      id: 'payment-test-id',
    });

    razorpayOrdersCreateMock.mockResolvedValue({
      id: 'order_coupon_test',
      amount: 13626,
      currency: 'INR',
    });

    const result = await service.createRazorpayOrder('user-test-id', {
      currency: 'INR',
      items: [
        {
          productId: '23',
          quantity: 1,
        },
      ],
      shipping_address: {
        pincode: '500001',
      },
      order_type: 'product',
      coupon_code: 'TEST10',
    });

    expect(couponsMock.validate).toHaveBeenCalledWith(
      'user-test-id',
      expect.objectContaining({
        code: 'TEST10',
        order_amount: 59,
        product_ids: ['23'],
      }),
    );

    expect(razorpayOrdersCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 13626,
        currency: 'INR',
      }),
    );

    expect(result.pricing.discount_amount).toBe('5.90');
    expect(result.pricing.total_amount).toBe('136.26');
  });
  it('should reject an invalid coupon and not create a Razorpay order', async () => {
    prismaMock.products.findMany.mockResolvedValue([
      {
        id: '23',
        title: 'sensor',
        price: new Prisma.Decimal(50),
        gst_rate: new Prisma.Decimal(18),
        status: 'active',
        in_stock: true,
        stock_quantity: 10,
        is_course: false,
        weight: new Prisma.Decimal(0.5),
        weight_kg: new Prisma.Decimal(0.5),
      },
    ]);

    shippingRatesMock.getShippingAmount.mockResolvedValue(83.16);

    couponsMock.validate.mockRejectedValue(
      new BadRequestException('Invalid coupon code'),
    );

    await expect(
      service.createRazorpayOrder('user-test-id', {
        currency: 'INR',
        items: [
          {
            productId: '23',
            quantity: 1,
          },
        ],
        shipping_address: {
          pincode: '500001',
        },
        order_type: 'product',
        coupon_code: 'INVALID999',
      }),
    ).rejects.toThrow('Invalid coupon code');

    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
    expect(prismaMock.payments.create).not.toHaveBeenCalled();
  });

  it('should include server-calculated shipping in the Razorpay amount', async () => {
    prismaMock.products.findMany.mockResolvedValue([
      {
        id: '23',
        title: 'sensor',
        price: new Prisma.Decimal(50),
        gst_rate: new Prisma.Decimal(18),
        status: 'active',
        in_stock: true,
        stock_quantity: 10,
        is_course: false,
        weight: new Prisma.Decimal(0.5),
        weight_kg: new Prisma.Decimal(0.5),
      },
    ]);

    shippingRatesMock.getShippingAmount.mockResolvedValue(83.16);

    prismaMock.payments.create.mockResolvedValue({
      id: 'payment-shipping-test',
    });

    razorpayOrdersCreateMock.mockResolvedValue({
      id: 'order_shipping_test',
      amount: 14216,
      currency: 'INR',
    });

    const result = await service.createRazorpayOrder('user-test-id', {
      currency: 'INR',
      items: [
        {
          productId: '23',
          quantity: 1,
        },
      ],
      shipping_address: {
        pincode: '500001',
      },
      order_type: 'product',
    });

    expect(shippingRatesMock.getShippingAmount).toHaveBeenCalledWith(
      expect.objectContaining({
        pickup_postcode: '500001',
        delivery_postcode: '500001',
        weight: 0.5,
        product_type: 'product',
      }),
      );

    expect(result.pricing.shipping_amount).toBe('83.16');
    expect(result.pricing.total_amount).toBe('142.16');

    expect(razorpayOrdersCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 14216,
        currency: 'INR',
      }),
    );
  });

  it('should create Razorpay order using exactly the server-calculated amount', async () => {
    prismaMock.products.findMany.mockResolvedValue([
      {
        id: '23',
        title: 'sensor',
        price: new Prisma.Decimal(100),
        gst_rate: new Prisma.Decimal(18),
        status: 'active',
        in_stock: true,
        stock_quantity: 10,
        is_course: false,
        weight: new Prisma.Decimal(0.5),
        weight_kg: new Prisma.Decimal(0.5),
      },
    ]);

    shippingRatesMock.getShippingAmount.mockResolvedValue(50);

    prismaMock.payments.create.mockResolvedValue({
      id: 'payment-amount-test',
    });

    razorpayOrdersCreateMock.mockResolvedValue({
      id: 'order_amount_test',
      amount: 16800,
      currency: 'INR',
    });

    const result = await service.createRazorpayOrder('user-test-id', {
      // Deliberately tampered frontend amount
      amount: 1,

      currency: 'INR',
      items: [
        {
          productId: '23',
          quantity: 1,
        },
      ],
      shipping_address: {
        pincode: '500001',
      },
      order_type: 'product',
    });

    // 100 + 18 GST + 50 shipping = 168
    expect(result.pricing.total_amount).toBe('168.00');

    expect(razorpayOrdersCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 16800,
        currency: 'INR',
      }),
    );

    expect(razorpayOrdersCreateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1,
      }),
    );
  });

  it('should reject unsupported currency', async () => {
    await expect(
      service.createRazorpayOrder('user-test-id', {
        currency: 'USD',
        items: [
          {
            productId: '23',
            quantity: 1,
          },
        ],
        shipping_address: {
          pincode: '500001',
        },
        order_type: 'product',
      }),
    ).rejects.toThrow('Only INR payments are currently supported');

    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
  });

  it('should reject unsupported order type', async () => {
    await expect(
      service.createRazorpayOrder('user-test-id', {
        currency: 'INR',
        items: [
          {
            productId: '23',
            quantity: 1,
          },
        ],
        shipping_address: {
          pincode: '500001',
        },
        order_type: 'unknown',
      }),
    ).rejects.toThrow(
      'Unsupported order type',
    );

    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
  });

  it('should reject an order with no items', async () => {
    await expect(
      service.createRazorpayOrder('user-test-id', {
        currency: 'INR',
        items: [],
        shipping_address: {
          pincode: '500001',
        },
        order_type: 'product',
      }),
    ).rejects.toThrow('At least one product is required');

    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
  });

  it('should reject an invalid delivery pincode', async () => {
    await expect(
      service.createRazorpayOrder('user-test-id', {
        currency: 'INR',
        items: [
          {
            productId: '23',
            quantity: 1,
          },
        ],
        shipping_address: {
          pincode: '123',
        },
        order_type: 'product',
      }),
    ).rejects.toThrow('A valid 6-digit delivery pincode is required');

    expect(shippingRatesMock.getShippingAmount).not.toHaveBeenCalled();
    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
  });

  it('should reject an order without a shipping address', async () => {
    await expect(
      service.createRazorpayOrder('user-test-id', {
        currency: 'INR',
        items: [
          {
            productId: '23',
            quantity: 1,
          },
        ],
        order_type: 'product',
      }),
    ).rejects.toThrow('A valid 6-digit delivery pincode is required');

    expect(shippingRatesMock.getShippingAmount).not.toHaveBeenCalled();
    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
  });

  it('should reject a coupon that reduces the payable amount to zero', async () => {
    prismaMock.products.findMany.mockResolvedValue([
      {
        id: '23',
        title: 'sensor',
        price: new Prisma.Decimal(50),
        gst_rate: new Prisma.Decimal(18),
        status: 'active',
        in_stock: true,
        stock_quantity: 10,
        is_course: false,
        weight: new Prisma.Decimal(0.5),
        weight_kg: new Prisma.Decimal(0.5),
      },
    ]);

    shippingRatesMock.getShippingAmount.mockResolvedValue(0);

    couponsMock.validate.mockResolvedValue({
      valid: true,
      coupon_id: 'coupon-high-discount',
      code: 'HIGH1000',
      discount_amount: 59,
      final_amount: 0,
    });

    await expect(
      service.createRazorpayOrder('user-test-id', {
        currency: 'INR',
        items: [
          {
            productId: '23',
            quantity: 1,
          },
        ],
        shipping_address: {
          pincode: '500001',
        },
        order_type: 'product',
        coupon_code: 'HIGH1000',
      }),
    ).rejects.toThrow(
      'Calculated order amount must be greater than zero',
    );

    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
  });

  it('should reject the order when shipping-rate calculation fails', async () => {
    prismaMock.products.findMany.mockResolvedValue([
      {
        id: '23',
        title: 'sensor',
        price: new Prisma.Decimal(50),
        gst_rate: new Prisma.Decimal(18),
        status: 'active',
        in_stock: true,
        stock_quantity: 10,
        is_course: false,
        weight: new Prisma.Decimal(0.5),
        weight_kg: new Prisma.Decimal(0.5),
      },
    ]);

    shippingRatesMock.getShippingAmount.mockRejectedValue(
      new Error('Shipping service unavailable'),
    );

    await expect(
      service.createRazorpayOrder('user-test-id', {
        currency: 'INR',
        items: [
          {
            productId: '23',
            quantity: 1,
          },
        ],
        shipping_address: {
          pincode: '500001',
        },
        order_type: 'product',
      }),
    ).rejects.toThrow('Shipping service unavailable');

    expect(razorpayOrdersCreateMock).not.toHaveBeenCalled();
    expect(prismaMock.payments.create).not.toHaveBeenCalled();
  });
  it('should reject an invalid signature before granting direct-course access', async () => {
    const orderId = 'order_invalid_signature_test';
    const paymentId = 'pay_invalid_signature_test';

    prismaMock.payments.findUnique.mockResolvedValue({
      id: 'payment-db-invalid-signature-test',
      user_id: 'user-test-id',
      status: 'created',
      amount: new Prisma.Decimal(118),
      currency: 'INR',
    });

    await expect(
      service.verifyPayment('user-test-id', {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: 'invalid-signature',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(razorpayOrdersFetchMock).not.toHaveBeenCalled();
    expect(razorpayPaymentsFetchMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(txMock.course_purchases.upsert).not.toHaveBeenCalled();
    expect(enrollmentsMock.createPaidEnrollment).not.toHaveBeenCalled();
  });

  it('should verify a direct paid course purchase without a store product', async () => {
    const orderId = 'order_direct_course_verify_test';
    const paymentId = 'pay_direct_course_verify_test';
    const signature = require('crypto')
      .createHmac('sha256', 'test_key_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    prismaMock.payments.findUnique.mockResolvedValue({
      id: 'payment-db-direct-course-test',
      user_id: 'user-test-id',
      status: 'created',
      amount: new Prisma.Decimal(118),
      currency: 'INR',
    });
    prismaMock.orders.findFirst.mockResolvedValue(null);
    prismaMock.invoices.findUnique.mockResolvedValue(null);
    prismaMock.courses.findUnique.mockResolvedValue({
      id: BigInt(5),
      title: 'IoT Fundamentals Course',
      price: new Prisma.Decimal(100),
      gst_rate: new Prisma.Decimal(18),
      is_free: false,
      is_published: true,
    });

    razorpayOrdersFetchMock.mockResolvedValue({
      id: orderId,
      amount: 11800,
      currency: 'INR',
      notes: {
        user_id: 'user-test-id',
        order_type: 'course',
        course_id: '5',
        items: '[]',
        shipping_amount: '0.00',
        coupon_code: '',
        subtotal_amount: '100.00',
        tax_amount: '18.00',
        discount_amount: '0.00',
        total_amount: '118.00',
      },
    });
    razorpayPaymentsFetchMock.mockResolvedValue({
      id: paymentId,
      order_id: orderId,
      status: 'captured',
    });

    storageMock.uploadPdf.mockResolvedValue({
      publicUrl: 'https://example.test/direct-course-invoice.pdf',
      key: 'direct-course-invoice-key',
    });
    txMock.orders.create.mockResolvedValue({
      id: 'db-order-direct-course-test',
    });
    txMock.course_purchases.upsert.mockResolvedValue({
      user_id: 'user-test-id',
      course_id: BigInt(5),
      access_granted: true,
      status: 'active',
    });
    txMock.invoices.create.mockResolvedValue({
      id: 'invoice-direct-course-test',
      order_id: 'db-order-direct-course-test',
    });
    txMock.payments.update.mockResolvedValue({
      id: 'payment-db-direct-course-test',
      status: 'captured',
    });
    enrollmentsMock.createPaidEnrollment.mockResolvedValue({
      user_id: 'user-test-id',
      course_id: BigInt(5),
      payment_status: 'completed',
      razorpay_order_id: orderId,
    });

    jest
      .spyOn(service as any, 'generateInvoicePdf')
      .mockResolvedValue(Buffer.from('test-pdf'));

    const result = await service.verifyPayment('user-test-id', {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });

    expect(result.success).toBe(true);
    expect(prismaMock.courses.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BigInt(5) } }),
    );
    expect(txMock.orders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          order_type: 'course',
          razorpay_order_id: orderId,
        }),
      }),
    );
    expect(txMock.course_purchases.upsert).toHaveBeenCalled();
    expect(enrollmentsMock.createPaidEnrollment).toHaveBeenCalledWith(
      'user-test-id',
      BigInt(5),
      orderId,
      txMock,
    );
    expect(txMock.invoices.create).toHaveBeenCalled();
    expect(txMock.payments.update).toHaveBeenCalled();
    expect(productsServiceMock.deductStock).not.toHaveBeenCalled();
  });
});