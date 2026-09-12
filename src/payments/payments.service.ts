import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

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

  async createRazorpayOrder(userId: string, dto: CreateRazorpayOrderDto) {
    const amountInPaise = Math.round(dto.amount * 100);

    const razorpayOrder = await this.razorpay.orders.create({
      amount: amountInPaise,
      currency: dto.currency || 'INR',
      receipt: dto.receipt || `receipt_${Date.now()}`,
    });

    // Save a pending payment in our database
    const payment = await this.prisma.payments.create({
      data: {
        user_id: userId,
        razorpay_order_id: razorpayOrder.id,
        amount: dto.amount,
        currency: dto.currency || 'INR',
        status: 'pending',
      },
    });

    return {
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      payment_id: payment.id,
      key_id: this.configService.get<string>('RAZORPAY_KEY_ID'),
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
        ? await this.prisma.invoices.findFirst({
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

    const updatedPayment = await this.prisma.payments.update({
      where: {
        razorpay_order_id: dto.razorpay_order_id,
      },
      data: {
        razorpay_payment_id: dto.razorpay_payment_id,
        razorpay_signature: dto.razorpay_signature,
        status: 'captured',
      },
    });

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()}`;

    const amount = Number(payment.amount);

    const pdfBuffer = await this.generateInvoicePdf(invoiceNumber, amount);

    const uploadedInvoice = await this.storageService.uploadPdf(
      `${invoiceNumber}.pdf`,
      pdfBuffer,
    );

    const order = await this.prisma.orders.create({
      data: {
        user_id: userId,
        payment_id: payment.id,
        total_amount: payment.amount,
        status: 'paid',
        invoice_url: uploadedInvoice.publicUrl,
      },
    });

    const invoice = await this.prisma.invoices.create({
      data: {
        order_id: order.id,
        user_id: userId,
        invoice_number: invoiceNumber,
        amount: payment.amount,
        invoice_url: uploadedInvoice.publicUrl,
      },
    });

    return {
      success: true,
      message: 'Payment verified and invoice generated successfully',
      payment: updatedPayment,
      order,
      invoice,
    };
  }

  private generateInvoicePdf(invoiceNumber: string, amount: number) {
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument();
      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      document.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      document.on('error', reject);

      document.fontSize(20).text('MakersFlow Invoice', {
        align: 'center',
      });

      document.moveDown();

      document.fontSize(12).text(`Invoice Number: ${invoiceNumber}`);
      document.text(`Date: ${new Date().toLocaleDateString()}`);
      document.text(`Amount Paid: ₹${amount.toFixed(2)}`);

      document.moveDown();

      document.fontSize(14).text('Thank you for your purchase!', {
        align: 'center',
      });

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
}
