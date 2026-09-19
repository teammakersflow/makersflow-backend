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

  const prismaMock = {
    products: {
      findMany: jest.fn(),
    },
    payments: {
      create: jest.fn(),
    },
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
          useValue: {},
        },

        {
          provide: EnrollmentsService,
          useValue: {},
        },

        {
          provide: ProductsService,
          useValue: {},
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
        order_type: 'course',
      }),
    ).rejects.toThrow(
      'Course-only and mixed-cart payments are not supported yet.',
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
});