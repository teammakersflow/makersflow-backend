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
} from '@nestjs/common';

import { PaymentsService } from './payments.service';

import { CreatePaymentDto } from './dto/create-payment.dto';

import { UpdatePaymentDto } from './dto/update-payment.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { RolesGuard } from '../auth/guards/roles.guard';

import { Roles } from '../auth/decorators/roles.decorator';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(
      createPaymentDto,
    );
  }

  @Get()
  findAll(@Query('include') include?: string) {
    const includeUser =
      include
        ?.split(',')
        .map((item) => item.trim())
        .includes('user') ?? false;

    return this.paymentsService.findAll(includeUser);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id')
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
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }
}