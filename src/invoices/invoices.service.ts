import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicePdfService } from './invoice-pdf.service';

@Injectable()
export class InvoiceService {
    constructor(
    private readonly prisma: PrismaService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();

    const latestInvoice = await this.prisma.invoices.findFirst({
      where: {
        invoice_number: {
          startsWith: `INV-${year}-`,
        },
      },
      orderBy: {
        invoice_number: 'desc',
      },
    });

    let nextNumber = 1;

    if (latestInvoice) {
      const lastNumber = Number(
        latestInvoice.invoice_number.split('-').pop(),
      );

      nextNumber = lastNumber + 1;
    }

    let invoiceNumber = `INV-${year}-${String(nextNumber).padStart(6, '0')}`;

    let numberExists = await this.prisma.invoices.findUnique({
      where: {
        invoice_number: invoiceNumber,
      },
    });

    while (numberExists) {
      nextNumber++;

      invoiceNumber = `INV-${year}-${String(nextNumber).padStart(6, '0')}`;

      numberExists = await this.prisma.invoices.findUnique({
        where: {
          invoice_number: invoiceNumber,
        },
      });
    }

    return invoiceNumber;
  }

  async createInvoice(orderId: string, userId: string) {
    const order = await this.prisma.orders.findFirst({
      where: {
        id: orderId,
        user_id: userId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const existingInvoice = await this.prisma.invoices.findFirst({
      where: {
        order_id: orderId,
      },
    });

    if (existingInvoice) {
      return existingInvoice;
    }

    const invoiceNumber = await this.generateInvoiceNumber();

    return this.prisma.invoices.create({
      data: {
        order_id: orderId,
        user_id: userId,
        invoice_number: invoiceNumber,
        amount: order.total_amount,
        tax_amount: 0,
      },
    });
  }

  async getInvoicePdf(
    invoiceId: string,
    userId: string,
  ): Promise<Buffer> {
    const invoice = await this.prisma.invoices.findFirst({
      where: {
        id: invoiceId,
        user_id: userId,
      },
      include: {
        orders: {
          include: {
            users: true,
            order_items: {
              include: {
                products: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (!invoice.orders) {
      throw new NotFoundException('Invoice order not found');
    }

    const pdfData = {
      invoice,
      order: invoice.orders,
      customer: invoice.orders.users,
      items: invoice.orders.order_items,
    };

    return this.invoicePdfService.generateInvoicePdf(
      pdfData,
    );
  }
}