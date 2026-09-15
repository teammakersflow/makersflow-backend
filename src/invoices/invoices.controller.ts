import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';

import type { Response } from 'express';

import { InvoiceService } from './invoices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoiceService: InvoiceService,
  ) {}

  @Post('orders/:orderId')
  async createInvoice(
    @Param('orderId') orderId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException(
        'Authenticated user not found',
      );
    }

    if (!/^[0-9a-fA-F-]{36}$/.test(orderId)) {
      throw new BadRequestException(
        'Invalid order ID',
      );
    }

    return this.invoiceService.createInvoice(
      orderId,
      userId,
    );
  }

  @Get(':id/pdf')
  async downloadInvoicePdf(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        errorHttpStatusCode: 400,
      }),
    )
    invoiceId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException(
        'Authenticated user not found',
      );
    }

    const pdf =
      await this.invoiceService.getInvoicePdf(
        invoiceId,
        userId,
      );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoiceId}.pdf"`,
      'Content-Length': pdf.length.toString(),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    res.send(pdf);
  }
}