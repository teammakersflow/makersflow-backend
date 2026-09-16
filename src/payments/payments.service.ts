import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { ProductsService } from '../products/products.service';

import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class PaymentsService {
  private razorpay: Razorpay;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private storageService: StorageService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly productsService: ProductsService,
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

    if (orderType !== 'product') {
      throw new BadRequestException(
        'This payment flow currently supports product orders only',
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
      const product = productMap.get(item.productId.toString());

      if (!product) {
        throw new NotFoundException(
          `Product ${item.productId.toString()} was not found`,
        );
      }

      if (product.price === null) {
        throw new BadRequestException(
          `Product "${product.title}" does not have a valid price`,
        );
      }

      if (product.price.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          `Product "${product.title}" has an invalid price`,
        );
      }

      if (product.status && product.status !== 'published') {
        throw new BadRequestException(
          `Product "${product.title}" is not available for purchase`,
        );
      }

      if (product.in_stock === false) {
        throw new BadRequestException(
          `Product "${product.title}" is out of stock`,
        );
      }

      const quantity = new Prisma.Decimal(item.quantity);
      const unitPrice = product.price;
      const gstRate = product.gst_rate || new Prisma.Decimal(0);

      /*
      * Option B:
      * Product price excludes GST.
      */
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

    /*
    * No shipping or discount is applied here because your current
    * order schema does not define a trusted shipping/discount calculation.
    */
    const shippingAmount = new Prisma.Decimal(0);
    const discountAmount = new Prisma.Decimal(0);

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
        items: JSON.stringify(normalizedItems.map((item) => ({
          productId: item.productId.toString(),
          quantity: item.quantity,
        }))),
        shipping_address: dto.shipping_address
          ? JSON.stringify(dto.shipping_address)
          : '',
        subtotal: subtotal.toFixed(2),
        tax_amount: taxAmount.toFixed(2),
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
      const existingOrder = await this.prisma.orders.findUnique({
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

      const calculatedTotal = subtotal
        .plus(taxAmount)
        .toDecimalPlaces(2);

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
          'Product                         Qty       Price       GST       Tax       Total',
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
}
