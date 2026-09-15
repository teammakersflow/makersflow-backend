import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class InvoicePdfService {
  async generateInvoicePdf(invoiceData: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      document.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      document.on('error', (error) => {
        reject(error);
      });

      const invoice = invoiceData.invoice;
      const order = invoiceData.order;
      const customer = invoiceData.customer;
      const items = invoiceData.items || [];

      const money = (value: unknown): string => {
        const amount = Number(value);

        if (!Number.isFinite(amount)) {
          return '₹0.00';
        }

        return `₹${amount.toFixed(2)}`;
      };
      const invoiceDate = invoice.created_at
        ? new Date(invoice.created_at).toLocaleDateString('en-IN')
        : new Date().toLocaleDateString('en-IN');

      // Header
      document
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('MakersFlow', { align: 'center' });

      document
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('INVOICE', { align: 'center' });

      document.moveDown();

      // Invoice information
      document
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice Number: ${invoice.invoice_number}`)
        .text(`Order ID: ${order.id}`)
        .text(`Invoice Date: ${invoiceDate}`);

      document.moveDown();

      // Customer information
      document
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Bill To');

      document
        .fontSize(10)
        .font('Helvetica')
        .text(`Name: ${customer?.full_name || 'N/A'}`)
        .text(`Email: ${customer?.email || 'N/A'}`);

      document.moveDown();

      // Shipping address
      document
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Shipping Address');

      document
        .fontSize(10)
        .font('Helvetica')
        .text(this.formatAddress(order.shipping_address));

      document.moveDown();

      // Products heading
      document
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Products');

      document.moveDown(0.5);

      // Table header
      document
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Product', 50, document.y, { continued: true })
        .text('Qty', 300, document.y, { continued: true })
        .text('Price', 350, document.y, { continued: true })
        .text('Total', 440, document.y);

      document.moveDown();

      // Product rows
      document.font('Helvetica');

      for (const item of items) {
        const productName = String(
          item.products?.title || 'Product',
        );

        const quantity = Math.max(
          0,
          Number(item.quantity || 0),
        );

        const unitPrice = Math.max(
          0,
          Number(item.unit_price || 0),
        );

        const totalPrice = quantity * unitPrice;

        const rowY = document.y;

        document
          .fontSize(9)
          .font('Helvetica')
          .text(productName, 50, rowY, {
            width: 230,
            height: 35,
            ellipsis: true,
          })
          .text(String(quantity), 300, rowY, {
            width: 35,
          })
          .text(money(unitPrice), 350, rowY, {
            width: 75,
          })
          .text(money(totalPrice), 440, rowY, {
            width: 105,
          });

        document.moveDown(1.5);
      }

      document.moveDown();

      // Amount summary
      document
        .fontSize(10)
        .font('Helvetica')
        .text(`Subtotal: ${money(order.subtotal)}`)
        .text(`Tax/GST: ${money(order.tax_amount)}`)
        .text(`Discount: ${money(order.discount_amount)}`)
        .text(
          `Total Amount: ${money(
            order.total_amount ?? invoice.amount,
          )}`,
        );

      document.moveDown();

      document
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Thank you for shopping with MakersFlow!', {
          align: 'center',
        });

      document.end();
    });
  }

  private formatAddress(address: unknown): string {
    if (!address) {
      return 'N/A';
    }

    if (typeof address === 'string') {
      return address.slice(0, 500);
    }

    if (
      typeof address === 'object' &&
      !Array.isArray(address)
    ) {
      return Object.entries(address as Record<string, unknown>)
        .filter(
          ([, value]) =>
            value !== null &&
            value !== undefined &&
            String(value).trim() !== '',
        )
        .map(
          ([key, value]) =>
            `${key}: ${String(value).slice(0, 150)}`,
        )
        .join(', ')
        .slice(0, 1000) || 'N/A';
    }

    return 'N/A';
  }
}