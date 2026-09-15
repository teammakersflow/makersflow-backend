import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoiceService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoiceService, InvoicePdfService],
  exports: [InvoiceService, InvoicePdfService],
})
export class InvoicesModule {}