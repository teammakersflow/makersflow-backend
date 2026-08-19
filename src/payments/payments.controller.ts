import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,

} from '@nestjs/common';

import type { Request } from 'express';

import { PaymentsService } from './payments.service';

import { CreatePaymentDto } from './dto/create-payment.dto';

import { UpdatePaymentDto } from './dto/update-payment.dto';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { RolesGuard } from '../auth/guards/roles.guard';

import { Roles } from '../auth/decorators/roles.decorator';

@Controller('payments')
@ApiBearerAuth()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  // ─────────────────────────────────────────────
  // RAZORPAY CREATE ORDER
  // ─────────────────────────────────────────────

  @Post('create-order')
  @UseGuards(JwtAuthGuard)
  createRazorpayOrder(
    @Req() req: Request,
    @Body() dto: CreateRazorpayOrderDto,
  ) {
    const user = req.user as any;

    return this.paymentsService.createRazorpayOrder(
      user.id,
      dto,
    );
  }

  // ─────────────────────────────────────────────
  // RAZORPAY VERIFY
  // ─────────────────────────────────────────────

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  verifyPayment(
    @Req() req: Request,
    @Body() dto: VerifyPaymentDto,
  ) {
    const user = req.user as any;

    return this.paymentsService.verifyPayment(
      user.id,
      dto,
    );
  }

  // ─────────────────────────────────────────────
  // ADMIN CRUD
  // ─────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(
      createPaymentDto,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAll(@Query('include') include?: string) {
    const includeUser =
      include
        ?.split(',')
        .map((item) => item.trim())
        .includes('user') ?? false;

    return this.paymentsService.findAll(includeUser);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentsService.update(
      id,
      updatePaymentDto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }
}