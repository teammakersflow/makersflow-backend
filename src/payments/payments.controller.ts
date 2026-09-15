import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { Request, Response } from 'express';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PaymentsService } from './payments.service';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Create Razorpay order
   */
  @Post('create-order')
  async createRazorpayOrder(
    @Req() req: Request,
    @Body() dto: CreateRazorpayOrderDto,
  ) {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new UnauthorizedException(
        'User is not authenticated. Please login first.',
      );
    }

    return this.paymentsService.createRazorpayOrder(userId, dto);
  }

  /**
   * Verify Razorpay payment
   */
  @Post('verify')
  async verifyPayment(
    @Req() req: Request,
    @Body() dto: VerifyPaymentDto,
  ) {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new UnauthorizedException(
        'User is not authenticated. Please login first.',
      );
    }

    return this.paymentsService.verifyPayment(userId, dto);
  }

  /**
   * Download user's invoice
   */
  @Get('invoice/:invoiceId')
  async downloadInvoice(
    @Req() req: Request,
    @Param('invoiceId') invoiceId: string,
    @Res() res: Response,
  ) {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new UnauthorizedException(
        'User is not authenticated. Please login first.',
      );
    }

    const invoice =
      await this.paymentsService.getInvoiceById(invoiceId, userId);

    if (!invoice || !invoice.invoice_key) {
      throw new NotFoundException('Invoice not found');
    }

    const downloadUrl =
      await this.storageService.getInvoiceDownloadUrl(
        invoice.invoice_key,
        `${invoice.invoice_number}.pdf`,
      );

    return res.redirect(downloadUrl);
  }
}