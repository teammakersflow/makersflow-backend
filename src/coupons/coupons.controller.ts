import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth } from '@nestjs/swagger';

import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { Req } from '@nestjs/common';
import type { Request } from 'express';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
@Controller('coupons')
@ApiBearerAuth()
export class CouponsController {
  constructor(
    private readonly couponsService: CouponsService,
  ) {}

  @Post()
  create(@Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.create(createCouponDto);
  }

  @Get()
  findAll() {
    return this.couponsService.findAll();
  }

  @Post('validate')
@UseGuards(JwtAuthGuard)
validate(
  @Req() req: Request,
  @Body() dto: ValidateCouponDto,
) {
  const user = req.user as any;

  return this.couponsService.validate(
    user.id,
    dto,
  );
}
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.couponsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCouponDto: UpdateCouponDto,
  ) {
    return this.couponsService.update(
      id,
      updateCouponDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}