import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { isEnrollmentActive } from '../enrollments/enrollment-access';
import { ProductsService } from '../products/products.service';
import { CouponsService } from '../coupons/coupons.service';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { StorageService } from '../storage/storage.service';
import { ShippingRatesService } from '../shipping-rates/shipping-rates.service';
import { CreateRefundDto } from './dto/create-refund.dto';

@Injectable()
export class PaymentsService {
  private razorpay: Razorpay;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private storageService: StorageService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly productsService: ProductsService,
    private couponsService: CouponsService,
    private readonly shippingRatesService: ShippingRatesService,
  ) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required');
    }

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  // ─────────────────────────────────────────────
  // CREATE RAZORPAY ORDER
  // ─────────────────────────────────────────────

  async createRazorpayOrder(
    userId: string,
    dto: CreateRazorpayOrderDto,
  ) {
    const currency = dto.currency || 'INR';
    const orderType = dto.order_type || 'product';

    if (currency !== 'INR') {
      throw new BadRequestException(
        'Only INR payments are currently supported',
      );
    }

    if (!['product', 'course'].includes(orderType)) {
      throw new BadRequestException('Unsupported order type');
    }
    if (orderType === 'course' && dto.course_id !== undefined) {
      if (!/^\d+$/.test(dto.course_id)) {
        throw new BadRequestException('Invalid course ID');
      }

      if (dto.coupon_code) {
        throw new BadRequestException(
          'Coupons are not supported for direct course purchases yet',
        );
      }

      if (dto.items && dto.items.length > 0) {
        throw new BadRequestException(
          'Direct course purchases must not include product items',
        );
      }

      const courseId = BigInt(dto.course_id);

      const course = await this.prisma.courses.findUnique({
        where: { id: courseId },
        select: {
          id: true,
          title: true,
          price: true,
          gst_rate: true,
          is_free: true,
          is_published: true,
        },
      });

      if (
        !course ||
        course.is_published !== true ||
        course.is_free !== false ||
        !course.price ||
        course.price.lessThanOrEqualTo(0)
      ) {
        throw new BadRequestException(
          'Course is unavailable for paid enrollment',
        );
      }

      const existingEnrollment = await this.prisma.enrollments.findUnique({
        where: {
          user_id_course_id: {
            user_id: userId,
            course_id: courseId,
          },
        },
      });

      const existingPurchase = await this.prisma.course_purchases.findUnique({
        where: {
          user_id_course_id: {
            user_id: userId,
            course_id: courseId,
          },
        },
      });

      // B-2 (2026-11-11): block only when the user really has access now.
      // A refunded, pending or otherwise inactive enrollment may be
      // re-purchased; fulfilment (createPaidEnrollment) then reactivates it.
      // Expiry is not enforced for now (ENROLLMENT_EXPIRY_ENFORCED), so an
      // expired 'completed' enrollment still counts as access. With no
      // enrollment row at all, an access-granted course_purchases row still
      // blocks, as before.
      const hasActiveEnrollment = isEnrollmentActive(existingEnrollment);
      if (
        hasActiveEnrollment ||
        (!existingEnrollment && existingPurchase?.access_granted === true)
      ) {
        throw new BadRequestException(
          'You already have access to this course',
        );
      }

      const subtotal = course.price;
      const taxAmount = subtotal
        .mul(course.gst_rate)
        .div(100)
        .toDecimalPlaces(2);
      const totalAmount = subtotal
        .plus(taxAmount)
        .toDecimalPlaces(2);
      const amountInPaise = totalAmount.mul(100).toNumber();

      if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
        throw new BadRequestException('Calculated course price is invalid');
      }

      const razorpayOrder = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency,
        receipt: dto.receipt || `course_${course.id}_${Date.now()}`,
        notes: {
          user_id: userId,
          order_type: 'course',
          course_id: course.id.toString(),
          items: '[]',
          shipping_amount: '0.00',
          coupon_code: '',
          subtotal: subtotal.toFixed(2),
          tax_amount: taxAmount.toFixed(2),
          discount_amount: '0.00',
          total_amount: totalAmount.toFixed(2),
        },
      });

      const payment = await this.prisma.payments.create({
        data: {
          user_id: userId,
          razorpay_order_id: razorpayOrder.id,
          amount: totalAmount,
          currency,
          status: 'pending',
        },
      });

      return {
        razorpay_order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        payment_id: payment.id,
        key_id: this.configService.get<string>('RAZORPAY_KEY_ID'),
        pricing: {
          subtotal: subtotal.toFixed(2),
          tax_amount: taxAmount.toFixed(2),
          shipping_amount: '0.00',
          discount_amount: '0.00',
          total_amount: totalAmount.toFixed(2),
          items: [{
            productId: course.id.toString(),
            title: course.title,
            quantity: 1,
            unitPrice: subtotal.toFixed(2),
            gstRate: course.gst_rate.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            lineSubtotal: subtotal.toFixed(2),
          }],
        },
      };
    }

    if (orderType === 'course' && !dto.course_id) {
      // Existing course-product checkout remains supported.
    } else if (dto.course_id !== undefined) {
      throw new BadRequestException(
        'course_id is only valid for direct course purchases',
      );
    }

    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException(
        'At least one product is required',
      );
    }

    /*
    * Normalize and validate requested items.
    */
    const normalizedItems = dto.items.map((item) => {
      const productId = String(item.productId);
      const quantity = Number(item.quantity);

      if (!/^\d+$/.test(productId)) {
        throw new BadRequestException(
          `Invalid product ID: ${productId}`,
        );
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException(
          `Invalid quantity for product ${productId}`,
        );
      }

      if (quantity > 100) {
        throw new BadRequestException(
          `Quantity is too high for product ${productId}`,
        );
      }

      return {
        productId: BigInt(productId),
        quantity,
      };
    });

    /*
    * Prevent duplicate product lines.
    * This avoids accidentally calculating the same product twice.
    */
    const uniqueProductIds = new Set(
      normalizedItems.map((item) => item.productId.toString()),
    );

    if (uniqueProductIds.size !== normalizedItems.length) {
      throw new BadRequestException(
        'Duplicate products are not allowed in the same order',
      );
    }

    /*
    * Fetch prices and GST rates only from the database.
    */
    const products = await this.prisma.products.findMany({
      where: {
        id: {
          in: normalizedItems.map((item) => item.productId),
        },
      },
      select: {
        id: true,
        title: true,
        price: true,
        gst_rate: true,
        status: true,
        in_stock: true,
        is_course: true,
        weight: true,
        weight_kg: true,
        stock_quantity: true,
      },
    });

    if (products.length !== normalizedItems.length) {
      throw new NotFoundException(
        'One or more products were not found',
      );
    }

    const productMap = new Map(
      products.map((product) => [
        product.id.toString(),
        product,
      ]),
    );

    let subtotal = new Prisma.Decimal(0);
    let taxAmount = new Prisma.Decimal(0);
    let totalWeightKg = new Prisma.Decimal(0);

    const invoiceItems: Array<{
      productId: string;
      title: string;
      quantity: number;
      unitPrice: string;
      gstRate: string;
      taxAmount: string;
      lineSubtotal: string;
    }> = [];

    for (const item of normalizedItems) {
      const product = productMap.get(
        item.productId.toString(),
      );

      if (!product) {
        throw new NotFoundException(
          `Product not found: ${item.productId.toString()}`,
        );
      }

      if (
        product.price === null ||
        product.price.lessThanOrEqualTo(0)
      ) {
        throw new BadRequestException(
          `Product "${product.title}" has an invalid price`,
        );
      }

      if (
        product.status &&
        !['active', 'published', 'available'].includes(product.status.toLowerCase())
      ) {
        throw new BadRequestException(
          `Product "${product.title}" is not available for purchase`,
        );
      }

      if (product.in_stock === false) {
        throw new BadRequestException(
          `Product "${product.title}" is out of stock`,
        );
      }

      
      if (
        product.stock_quantity !== null &&
        product.stock_quantity !== undefined &&
        Number(product.stock_quantity) >= 0 &&
        item.quantity > Number(product.stock_quantity)
      ) {
        throw new BadRequestException(
          `Insufficient stock for product "${product.title}". Available: ${product.stock_quantity}`,
        );
      }

      const quantity = new Prisma.Decimal(item.quantity);

      const unitPrice = product.price;
      const gstRate = product.gst_rate || new Prisma.Decimal(0);

      const productWeight = product.weight_kg ?? product.weight;

      if (
        productWeight === null ||
        productWeight === undefined ||
        new Prisma.Decimal(productWeight).lessThanOrEqualTo(0)
      ) {
        throw new BadRequestException(
          `Product "${product.title}" has an invalid weight`,
        );
      }

      totalWeightKg = totalWeightKg
        .plus(new Prisma.Decimal(productWeight).mul(quantity))
        .toDecimalPlaces(3);

      const lineSubtotal = unitPrice
        .mul(quantity)
        .toDecimalPlaces(2);

      const lineTax = lineSubtotal
        .mul(gstRate)
        .div(100)
        .toDecimalPlaces(2);

      subtotal = subtotal
        .plus(lineSubtotal)
        .toDecimalPlaces(2);

      taxAmount = taxAmount
        .plus(lineTax)
        .toDecimalPlaces(2);

      invoiceItems.push({
        productId: product.id.toString(),
        title: product.title,
        quantity: item.quantity,
        unitPrice: unitPrice.toFixed(2),
        gstRate: gstRate.toFixed(2),
        taxAmount: lineTax.toFixed(2),
        lineSubtotal: lineSubtotal.toFixed(2),
      });
    }  // <-- IMPORTANT: closes the for loop

    let shippingAmount = new Prisma.Decimal(0);

    /*
    * No shipping or discount is applied here because your current
    * order schema does not define a trusted shipping/discount calculation.
    */
    let discountAmount = new Prisma.Decimal(0);

    const pickupPostcode =
      this.configService.get<string>('SHIPROCKET_PICKUP_POSTCODE');

    const deliveryPostcode = String(
      dto.shipping_address?.pincode ??
        dto.shipping_address?.postal_code ??
        dto.shipping_address?.postcode ??
        '',
    ).trim();

    if (!pickupPostcode) {
      throw new InternalServerErrorException(
        'Shiprocket pickup postcode is not configured',
      );
    }

    if (!/^\d{6}$/.test(deliveryPostcode)) {
      throw new BadRequestException(
        'A valid 6-digit delivery pincode is required',
      );
    }

    shippingAmount = new Prisma.Decimal(
      await this.shippingRatesService.getShippingAmount({
        pickup_postcode: pickupPostcode,
        delivery_postcode: deliveryPostcode,
        weight: Math.max(totalWeightKg.toNumber(), 0.1),
        product_type: 'product',
      }),
    );

    if (dto.coupon_code) {
      const productIds = normalizedItems.map((item) =>
        String(item.productId),
      );

      const courseIds = normalizedItems
        .filter((item) => {
          const product = productMap.get(
            item.productId.toString(),
          );

          return product?.is_course === true;
        })
        .map((item) => String(item.productId));

      const couponResult = await this.couponsService.validate(userId, {
        code: dto.coupon_code,
        order_amount: subtotal.plus(taxAmount).toNumber(),
        product_ids: productIds,
        course_ids: courseIds,
      });

      if (!couponResult.valid) {
        throw new BadRequestException(
          'Invalid or unusable coupon',
        );
      }

      discountAmount = new Prisma.Decimal(
        couponResult.discount_amount,
      );
    }

    const totalAmount = subtotal
      .plus(taxAmount)
      .plus(shippingAmount)
      .minus(discountAmount)
      .toDecimalPlaces(2);

    if (totalAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Calculated order amount must be greater than zero',
      );
    }

    /*
    * Razorpay expects the amount in paise.
    */
    const amountInPaise = totalAmount
      .mul(100)
      .toNumber();

    if (!Number.isSafeInteger(amountInPaise)) {
      throw new BadRequestException(
        'Calculated payment amount is invalid',
      );
    }

    const razorpayOrder = await this.razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: dto.receipt || `receipt_${Date.now()}`,
      notes: {
        user_id: userId,
        order_type: orderType,

        items: JSON.stringify(
          normalizedItems.map((item) => ({
            productId: item.productId.toString(),
            quantity: item.quantity,
          })),
        ),

        shipping_address: dto.shipping_address
          ? JSON.stringify(dto.shipping_address)
          : '',

        coupon_code: dto.coupon_code || '',

        subtotal: subtotal.toFixed(2),
        tax_amount: taxAmount.toFixed(2),
        shipping_amount: shippingAmount.toFixed(2),
        discount_amount: discountAmount.toFixed(2),
        total_amount: totalAmount.toFixed(2),
      },
    });

    const payment = await this.prisma.payments.create({
      data: {
        user_id: userId,
        razorpay_order_id: razorpayOrder.id,
        amount: totalAmount,
        currency,
        status: 'pending',
      },
    });

    return {
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      payment_id: payment.id,
      key_id: this.configService.get<string>('RAZORPAY_KEY_ID'),

      /*
      * These values help the frontend display the same calculation.
      * They are informational only; the backend remains authoritative.
      */
      pricing: {
        subtotal: subtotal.toFixed(2),
        tax_amount: taxAmount.toFixed(2),
        shipping_amount: shippingAmount.toFixed(2),
        discount_amount: discountAmount.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        items: invoiceItems,
      },
    };
  }

  // ─────────────────────────────────────────────
  // VERIFY PAYMENT
  // ─────────────────────────────────────────────

  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const payment = await this.prisma.payments.findUnique({
      where: {
        razorpay_order_id: dto.razorpay_order_id,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    if (payment.user_id !== userId) {
      throw new BadRequestException('Payment does not belong to this user');
    }

    if (payment.status === 'captured') {
      const existingOrder = await this.prisma.orders.findFirst({
        where: {
          payment_id: payment.id,
        },
      });

      const existingInvoice = existingOrder
        ? await this.prisma.invoices.findUnique({
            where: {
              order_id: existingOrder.id,
            },
          })
        : null;

      return {
        success: true,
        message: 'Payment was already verified',
        payment,
        order: existingOrder,
        invoice: existingInvoice,
      };
    }

    const existingOrderForPayment = await this.prisma.orders.findFirst({
      where: {
        payment_id: payment.id,
      },
    });

    if (existingOrderForPayment) {
      const existingInvoice = await this.prisma.invoices.findUnique({
        where: {
          order_id: existingOrderForPayment.id,
        },
      });

      return {
        success: true,
        message: 'Order was already created for this payment',
        payment,
        order: existingOrderForPayment,
        invoice: existingInvoice,
      };
    }

    const secret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (!secret) {
      throw new BadRequestException('Razorpay secret is not configured');
    }

    const body = dto.razorpay_order_id + '|' + dto.razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const receivedBuffer = Buffer.from(dto.razorpay_signature, 'hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      throw new BadRequestException('Invalid Razorpay payment signature');
    }

    const razorpayOrder = await this.razorpay.orders.fetch(
      dto.razorpay_order_id,
    );

    const razorpayPayment = await this.razorpay.payments.fetch(
      dto.razorpay_payment_id,
    );

    if (razorpayPayment.order_id !== dto.razorpay_order_id) {
      throw new BadRequestException(
        'Payment does not belong to the Razorpay order',
      );
    }

    if (razorpayPayment.status !== 'captured') {
      throw new BadRequestException(
        `Razorpay payment is not captured. Current status: ${razorpayPayment.status}`,
      );
    }

    const razorpayAmountInPaise = Number(razorpayOrder.amount);

    const databaseAmountInPaise = Math.round(
      Number(payment.amount) * 100,
    );

    if (razorpayAmountInPaise !== databaseAmountInPaise) {
      throw new BadRequestException(
        'Payment amount does not match the Razorpay order amount',
      );
    }

    const razorpayCurrency = razorpayOrder.currency;
    const databaseCurrency = payment.currency || 'INR';

    if (razorpayCurrency !== databaseCurrency) {
      throw new BadRequestException(
        'Payment currency does not match the Razorpay order currency',
      );
    }

    const orderNotes = razorpayOrder.notes || {};
    const directOrderType =
      typeof orderNotes.order_type === 'string'
        ? orderNotes.order_type
        : 'product';

    if (
      directOrderType === 'course' &&
      typeof orderNotes.course_id === 'string'
    ) {
      return this.verifyDirectCoursePayment(
        userId,
        dto,
        payment,
        orderNotes,
      );
    }

    let orderItems: Record<string, any> | undefined;
    let shippingAddress: Record<string, any> | undefined;

    try {
      if (typeof orderNotes.items === 'string') {
        orderItems = JSON.parse(orderNotes.items);
      }
    } catch {
      orderItems = undefined;
    }

    try {
      if (typeof orderNotes.shipping_address === 'string') {
        shippingAddress = JSON.parse(orderNotes.shipping_address);
      }
    } catch {
      shippingAddress = undefined;
    }

    const normalizedItems = this.normalizeOrderItems(orderItems);
    const orderType =
      typeof orderNotes.order_type === 'string'
        ? orderNotes.order_type
        : 'product';

      /*
      * Recalculate subtotal and GST from database product prices.
      * Never trust frontend values or Razorpay notes for pricing.
      */
      const productIds = normalizedItems.map((item) => item.product_id);
      const products = await this.prisma.products.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
        select: {
          id: true,
          title: true,
          price: true,
          gst_rate: true,
          status: true,
          in_stock: true,
          is_course: true,
        },
      });

      if (products.length !== productIds.length) {
        throw new NotFoundException(
          'One or more products could not be found',
        );
      }


      const productMap = new Map(
        products.map((product) => [
          product.id.toString(),
          product,
        ]),
      );

      let subtotal = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);

      const invoiceItems: Array<{
        productId: string;
        title: string;
        quantity: number;
        unitPrice: string;
        gstRate: string;
        taxAmount: string;
        lineSubtotal: string;
      }> = [];

      for (const item of normalizedItems) {
        const product = productMap.get(
          item.product_id.toString(),
        );

        if (!product) {
          throw new NotFoundException(
            `Product not found: ${item.product_id.toString()}`,
          );
        }

        if (
          product.price === null ||
          product.price.lessThanOrEqualTo(0)
        ) {
          throw new BadRequestException(
            `Product "${product.title}" has an invalid price`,
          );
        }

        if (!product.in_stock) {
          throw new BadRequestException(
              `Product "${product.title}" is out of stock`,
            );
          }

          const quantity = new Prisma.Decimal(item.quantity);
          const unitPrice = product.price;
          const gstRate = product.gst_rate || new Prisma.Decimal(0);

          const lineSubtotal = unitPrice
            .mul(quantity)
            .toDecimalPlaces(2);

          const lineTax = lineSubtotal
            .mul(gstRate)
            .div(100)
            .toDecimalPlaces(2);

          subtotal = subtotal
            .plus(lineSubtotal)
            .toDecimalPlaces(2);

          taxAmount = taxAmount
            .plus(lineTax)
            .toDecimalPlaces(2);

          invoiceItems.push({
            productId: product.id.toString(),
            title: product.title,
            quantity: item.quantity,
            unitPrice: unitPrice.toFixed(2),
            gstRate: gstRate.toFixed(2),
            taxAmount: lineTax.toFixed(2),
            lineSubtotal: lineSubtotal.toFixed(2),
          });
      }

      const shippingAmount = new Prisma.Decimal(
        typeof orderNotes.shipping_amount === 'string'
          ? orderNotes.shipping_amount
          : '0',
      );

      const discountAmount = new Prisma.Decimal(
        typeof orderNotes.discount_amount === 'string'
          ? orderNotes.discount_amount
          : '0',
      );

      if (shippingAmount.lessThan(0) || discountAmount.lessThan(0)) {
        throw new BadRequestException(
          'Invalid shipping or discount amount',
        );
      }

      const calculatedTotal = subtotal
        .plus(taxAmount)
        .plus(shippingAmount)
        .minus(discountAmount)
        .toDecimalPlaces(2);

      if (calculatedTotal.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'Calculated order amount must be greater than zero',
        );
      }

      const calculatedAmountInPaise = calculatedTotal
        .mul(100)
        .toNumber();

      if (
        !Number.isSafeInteger(calculatedAmountInPaise) ||
        calculatedAmountInPaise <= 0
      ) {
        throw new BadRequestException(
          'Calculated payment amount is invalid',
        );
      }

      /*
      * Confirm that the stored payment amount also matches
      * the freshly calculated database amount.
      */
      const storedAmountInPaise = payment.amount
        .mul(100)
        .toNumber();

      if (storedAmountInPaise !== calculatedAmountInPaise) {
        throw new BadRequestException(
          'Stored payment amount does not match current product pricing',
        );
      }

      const invoiceNumber =
        await this.generateUniqueInvoiceNumber();

      const orderId = crypto.randomUUID();

      const pdfBuffer = await this.generateInvoicePdf(
        invoiceNumber,
        orderId,
        new Date(),
        invoiceItems,
        subtotal.toNumber(),
        taxAmount.toNumber(),
        shippingAmount.toNumber(),
        discountAmount.toNumber(),
        calculatedTotal.toNumber(),
        shippingAddress,
      );
      let invoiceKey: string | undefined;

      const invoiceFileName = `invoice-${orderId}.pdf`;
      try {
      const uploadedInvoice = await this.storageService.uploadPdf(
        invoiceFileName,
        pdfBuffer,
      );

      const invoiceUrl = uploadedInvoice.publicUrl;
      invoiceKey = uploadedInvoice.key;

      const result = await this.prisma.$transaction(async (tx) => {
    /*
    * Fetch product prices from the database.
    * Never trust product prices sent by the frontend.
    */

    /*
    * Prepare order items with the actual database price.
    */
      const orderItemRows = normalizedItems.map((item) => {
      const product = productMap.get(
        item.product_id.toString(),
      );

      if (!product) {
        throw new NotFoundException(
          `Product not found: ${item.product_id.toString()}`,
        );
      }

      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.price!,
        user_id: userId,
      };
    });

    /*
    * Create the order.
    */
    const order = await tx.orders.create({
      data: {
        id: orderId,
        user_id: userId,
        payment_id: payment.id,
        razorpay_order_id: dto.razorpay_order_id,
        razorpay_payment_id: dto.razorpay_payment_id,

        total_amount: calculatedTotal,
        subtotal,
        tax_amount: taxAmount,
        status: 'paid',
        order_type: orderType,

        ...(orderItems !== undefined
          ? {
              items: orderItems as Prisma.InputJsonValue,
            }
          : {}),

        ...(shippingAddress !== undefined
          ? {
              shipping_address:
                shippingAddress as Prisma.InputJsonValue,
            }
          : {}),

        invoice_url: uploadedInvoice.publicUrl,
      },
    });
    /*
    * Create order_items records and fulfill each item.
    */
    if (orderItemRows.length > 0) {
      await tx.order_items.createMany({
        data: orderItemRows.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          user_id: item.user_id,
        })),
      });

      /*
      * Fulfill courses and physical products inside
      * the same Prisma transaction.
      */
      for (const item of orderItemRows) {
        const product = productMap.get(item.product_id.toString());

        if (!product) {
          throw new NotFoundException(
            `Product not found: ${item.product_id.toString()}`,
          );
        }

        if (product.is_course === true) {
          /*
          * Course fulfillment:
          * Create the paid enrollment.
          */
          await this.enrollmentsService.createPaidEnrollment(
            userId,
            item.product_id,
            dto.razorpay_order_id,
            tx,
          );
        } else {
          /*
          * Physical product fulfillment:
          * Deduct inventory atomically.
          */
          await this.productsService.deductStock(
            item.product_id,
            item.quantity,
            tx,
          );
        }
      }
    }

    /*
    * Create invoice record.
    */
    const invoice = await tx.invoices.create({
      data: {
        order_id: order.id,
        user_id: userId,
        invoice_number: invoiceNumber,
        amount: calculatedTotal,
        tax_amount: taxAmount,
        invoice_url: uploadedInvoice.publicUrl,
        invoice_key: uploadedInvoice.key,
      },
    });

    /*
    * Record coupon usage only after successful payment verification.
    * This keeps coupon usage atomic with the order/payment transaction.
    */
    const couponCode =
      typeof orderNotes.coupon_code === 'string'
        ? orderNotes.coupon_code.trim()
        : '';

    if (couponCode) {
      const coupon = await tx.coupons.findUnique({
        where: {
          code: couponCode,
        },
      });

      if (!coupon) {
        throw new BadRequestException('Invalid coupon code');
      }

      const alreadyUsed = await tx.coupon_usage.findUnique({
        where: {
          coupon_id_user_id: {
            coupon_id: coupon.id,
            user_id: userId,
          },
        },
      });

      if (alreadyUsed) {
        throw new BadRequestException(
          'You have already used this coupon',
        );
      }

      /*
      * Atomically increment usage only when the usage limit
      * has not already been reached.
      */
      if (coupon.usage_limit !== null) {
        const usageUpdate = await tx.coupons.updateMany({
          where: {
            id: coupon.id,
            usage_count: {
              lt: coupon.usage_limit,
            },
          },
          data: {
            usage_count: {
              increment: 1,
            },
          },
        });

        if (usageUpdate.count !== 1) {
          throw new BadRequestException(
            'Coupon usage limit reached',
          );
        }
      } else {
        await tx.coupons.update({
          where: {
            id: coupon.id,
          },
          data: {
            usage_count: {
              increment: 1,
            },
          },
        });
      }

      await tx.coupon_usage.create({
        data: {
          coupon_id: coupon.id,
          user_id: userId,
          order_id: order.id,
          discount_amount: discountAmount,
        },
      });
    }

    /*
    * Mark payment as captured only after all fulfillment succeeds.
    */
    const updatedPayment = await tx.payments.update({
      where: {
        id: payment.id,
      },
      data: {
        razorpay_payment_id: dto.razorpay_payment_id,
        razorpay_signature: dto.razorpay_signature,
        status: 'captured',
      },
    });
    
    return {
      updatedPayment,
      order,
      invoice,
    };
  });

    return {
      success: true,
      message: 'Payment verified and invoice generated successfully',
      payment: result.updatedPayment,
      order: result.order,
      invoice: result.invoice,
    };
    } catch (error) {
      if (invoiceKey) {
        try {
          await this.storageService.deleteObject(invoiceKey);
        } catch (cleanupError) {
          console.error(
            'Failed to delete orphaned invoice PDF:',
            cleanupError,
          );
        }
      }

      throw error;
    }
  }

  private async verifyDirectCoursePayment(
    userId: string,
    dto: VerifyPaymentDto,
    payment: any,
    orderNotes: Record<string, any>,
  ) {
    if (orderNotes.user_id !== userId) {
      throw new BadRequestException('Course order user does not match');
    }

    const courseIdText = orderNotes.course_id;
    if (typeof courseIdText !== 'string' || !/^\d+$/.test(courseIdText)) {
      throw new BadRequestException('Invalid course ID in Razorpay order');
    }

    const courseId = BigInt(courseIdText);
    const course = await this.prisma.courses.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        kit_id: true,
        title: true,
        price: true,
        gst_rate: true,
        is_free: true,
        is_published: true,
      },
    });

    if (
      !course ||
      course.is_published !== true ||
      course.is_free !== false ||
      !course.price ||
      course.price.lessThanOrEqualTo(0)
    ) {
      throw new BadRequestException('Course is no longer available for paid enrollment');
    }

    const subtotal = course.price.toDecimalPlaces(2);
    const taxAmount = subtotal
      .mul(course.gst_rate)
      .div(100)
      .toDecimalPlaces(2);
    const calculatedTotal = subtotal.plus(taxAmount).toDecimalPlaces(2);

    if (!payment.amount.toDecimalPlaces(2).equals(calculatedTotal)) {
      throw new BadRequestException(
        'Course price has changed since the payment order was created',
      );
    }

    const calculatedAmountInPaise = calculatedTotal.mul(100).toNumber();
    if (
      !Number.isSafeInteger(calculatedAmountInPaise) ||
      calculatedAmountInPaise <= 0
    ) {
      throw new BadRequestException('Calculated course payment is invalid');
    }

    const invoiceNumber = await this.generateUniqueInvoiceNumber();
    const orderId = crypto.randomUUID();

    const invoiceItems = [{
      productId: course.id.toString(),
      title: course.title,
      quantity: 1,
      unitPrice: subtotal.toFixed(2),
      gstRate: course.gst_rate.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      lineSubtotal: subtotal.toFixed(2),
    }];

    const pdfBuffer = await this.generateInvoicePdf(
      invoiceNumber,
      orderId,
      new Date(),
      invoiceItems,
      subtotal.toNumber(),
      taxAmount.toNumber(),
      0,
      0,
      calculatedTotal.toNumber(),
      undefined,
    );

    let invoiceKey: string | undefined;

    try {
      const uploadedInvoice = await this.storageService.uploadPdf(
        `invoice-${orderId}.pdf`,
        pdfBuffer,
      );
      invoiceKey = uploadedInvoice.key;

      const result = await this.prisma.$transaction(async (tx) => {
        const order = await tx.orders.create({
          data: {
            id: orderId,
            user_id: userId,
            payment_id: payment.id,
            razorpay_order_id: dto.razorpay_order_id,
            razorpay_payment_id: dto.razorpay_payment_id,
            total_amount: calculatedTotal,
            subtotal,
            tax_amount: taxAmount,
            discount_amount: new Prisma.Decimal(0),
            status: 'paid',
            order_type: 'course',
            items: [{
              course_id: course.id.toString(),
              title: course.title,
              quantity: 1,
              unit_price: subtotal.toFixed(2),
            }] as Prisma.InputJsonValue,
            invoice_url: uploadedInvoice.publicUrl,
          },
        });

        const purchase = await tx.course_purchases.upsert({
          where: {
            user_id_course_id: {
              user_id: userId,
              course_id: course.id,
            },
          },
          create: {
            user_id: userId,
            course_id: course.id,
            payment_id: payment.id,
            order_id: order.id,
            amount_paid: calculatedTotal,
            access_granted: true,
            status: 'active',
          },
          update: {
            access_granted: true,
            status: 'active',
          },
        });

        if (course.kit_id) {
          await tx.included_kit_claims.upsert({
            where: { course_purchase_id: purchase.id },
            create: {
              user_id: userId,
              course_purchase_id: purchase.id,
              kit_id: course.kit_id,
              status: 'pending',
            },
            update: {},
          });
        }

        await this.enrollmentsService.createPaidEnrollment(
          userId,
          course.id,
          dto.razorpay_order_id,
          tx,
        );

        const invoice = await tx.invoices.create({
          data: {
            order_id: order.id,
            user_id: userId,
            invoice_number: invoiceNumber,
            amount: calculatedTotal,
            tax_amount: taxAmount,
            invoice_url: uploadedInvoice.publicUrl,
            invoice_key: uploadedInvoice.key,
          },
        });

        const updatedPayment = await tx.payments.update({
          where: { id: payment.id },
          data: {
            razorpay_payment_id: dto.razorpay_payment_id,
            razorpay_signature: dto.razorpay_signature,
            status: 'captured',
          },
        });

        return { order, invoice, updatedPayment };
      });

      return {
        success: true,
        message: 'Course payment verified and enrollment completed',
        payment: result.updatedPayment,
        order: result.order,
        invoice: result.invoice,
      };
    } catch (error) {
      if (invoiceKey) {
        try {
          await this.storageService.deleteObject(invoiceKey);
        } catch (cleanupError) {
          console.error('Failed to delete orphaned course invoice:', cleanupError);
        }
      }
      throw error;
    }
  }

  private async generateUniqueInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < 5; attempt++) {
      const invoiceNumber = `INV-${year}-${Date.now()}-${Math.floor(
        Math.random() * 1000,
      )}`;

      const existingInvoice = await this.prisma.invoices.findUnique({
        where: {
          invoice_number: invoiceNumber,
        },
      });

      if (!existingInvoice) {
        return invoiceNumber;
      }
    }

    throw new BadRequestException(
      'Unable to generate a unique invoice number',
    );
  }

  private normalizeOrderItems(
    items: Record<string, any> | undefined,
  ): Array<{
    product_id: bigint;
    quantity: number;
  }> {
    if (!items) {
      return [];
    }

    const rawItems = Array.isArray(items)
      ? items
      : Array.isArray(items.items)
        ? items.items
        : [items];

    return rawItems.map((item) => {
      const productId = item.product_id ?? item.productId ?? item.id;
      const quantity = Number(item.quantity ?? item.qty ?? 1);

      if (
        productId === undefined ||
        productId === null ||
        productId === ''
      ) {
        throw new BadRequestException(
          'Each order item must contain a product_id',
        );
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException(
          'Each order item must contain a valid quantity',
        );
      }

      try {
        return {
          product_id: BigInt(productId),
          quantity,
        };
      } catch {
        throw new BadRequestException(
          `Invalid product_id: ${productId}`,
        );
      }
    });
  }

  private generateInvoicePdf(
    invoiceNumber: string,
    orderId: string,
    invoiceDate: Date,
    invoiceItems: Array<{
      productId: string;
      title: string;
      quantity: number;
      unitPrice: string;
      gstRate: string;
      taxAmount: string;
      lineSubtotal: string;
    }>,
    subtotal: number,
    taxAmount: number,
    shippingAmount: number,
    discountAmount: number,
    totalAmount: number,
    shippingAddress?: Record<string, any>,
  ) {
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        margin: 50,
        size: 'A4',
      });

      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      document.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      document.on('error', reject);

      const formatCurrency = (value: number) =>
        `INR ${value.toFixed(2)}`;

      const formatDate = (date: Date) =>
        date.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

      /*
      * Header
      */
      document
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('MakersFlow', {
          align: 'center',
        });

      document
        .fontSize(16)
        .font('Helvetica')
        .text('TAX INVOICE', {
          align: 'center',
        });

      document.moveDown();

      /*
      * Invoice details
      */
      document
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(`Invoice Number: ${invoiceNumber}`);

      document
        .font('Helvetica')
        .text(`Order ID: ${orderId}`);

      document.text(`Invoice Date: ${formatDate(invoiceDate)}`);

      document.moveDown();

      /*
      * Customer/shipping details
      */
      document
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('Customer Details');

      document.fontSize(10).font('Helvetica');

      if (shippingAddress) {
        for (const [key, value] of Object.entries(shippingAddress)) {
          if (value !== undefined && value !== null && value !== '') {
            const label = key
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (char) => char.toUpperCase());

            document.text(`${label}: ${String(value)}`);
          }
        }
      } else {
        document.text('Shipping address not provided');
      }

      document.moveDown();

      /*
      * Items heading
      */
      document
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('Order Items');

      document.moveDown(0.5);

      /*
      * Table header
      */
      document
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(
          'Product Qty Price GST Tax Total',
        );

      document.moveDown(0.5);

      /*
      * Product rows
      */
      document.font('Helvetica');

      for (const item of invoiceItems) {
        const lineTotal =
          Number(item.lineSubtotal) + Number(item.taxAmount);

        document.text(
          `${item.title.substring(0, 28).padEnd(30)} ` +
            `${String(item.quantity).padStart(3)} ` +
            `${formatCurrency(Number(item.unitPrice)).padStart(12)} ` +
            `${`${item.gstRate}%`.padStart(6)} ` +
            `${formatCurrency(Number(item.taxAmount)).padStart(12)} ` +
            `${formatCurrency(lineTotal).padStart(12)}`,
        );

        document.moveDown(0.3);
      }

      document.moveDown();

      /*
      * Totals
      */
      document
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(`Subtotal: ${formatCurrency(subtotal)}`, {
          align: 'right',
        });

      document
        .font('Helvetica')
        .text(`GST/Tax: ${formatCurrency(taxAmount)}`, {
          align: 'right',
        });

      document
        .font('Helvetica')
        .text(`Shipping: ${formatCurrency(shippingAmount)}`, {
          align: 'right',
        });

      document
        .font('Helvetica')
        .text(`Discount: -${formatCurrency(discountAmount)}`, {
          align: 'right',
        });

      document
        .font('Helvetica-Bold')
        .text(`Total Paid: ${formatCurrency(totalAmount)}`, {
          align: 'right',
        });

      document.moveDown(2);

      document
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Thank you for your purchase!', {
          align: 'center',
        });

      document
        .fontSize(9)
        .font('Helvetica')
        .text(
          'This is a computer-generated invoice and does not require a signature.',
          {
            align: 'center',
          },
        );

      document.end();
    });
  }


  // ─────────────────────────────────────────────
  // EXISTING CRUD
  // ─────────────────────────────────────────────

  create(createPaymentDto: CreatePaymentDto) {
    return this.prisma.payments.create({
      data: createPaymentDto,
    });
  }

  async findAll(includeUser = false) {
    if (!includeUser) {
      return this.prisma.payments.findMany();
    }

    const payments = await this.prisma.payments.findMany({
      include: {
        users: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
        },
      },
    });

    return payments.map(({ users, ...payment }) => ({
      ...payment,
      user: users,
    }));
  }

  findOne(id: string) {
    return this.prisma.payments.findUnique({
      where: { id },
    });
  }

  update(id: string, updatePaymentDto: UpdatePaymentDto) {
    return this.prisma.payments.update({
      where: { id },
      data: updatePaymentDto,
    });
  }

  remove(id: string) {
    return this.prisma.payments.delete({
      where: { id },
    });
  }

  async getInvoiceById(invoiceId: string, userId: string) {
    return this.prisma.invoices.findFirst({
      where: {
        id: invoiceId,
        user_id: userId,
      },
    });
  }

  async createRefund(
    orderId: string,
    dto: CreateRefundDto, 
  ) {
    // Refund implementation will be added after validating
    // the order-payment relationship and duplicate-refund safeguards.
    throw new Error('Refund service implementation is pending validation');
  }
}
