import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CouponUsageService } from './coupon-usage.service';
import { CreateCouponUsageDto } from './dto/create-coupon-usage.dto';
import { UpdateCouponUsageDto } from './dto/update-coupon-usage.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('coupon-usage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class CouponUsageController {
  constructor(
    private readonly couponUsageService: CouponUsageService,
  ) {}

  @Get()
  findAll() {
    return this.couponUsageService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.couponUsageService.findOne(id);
  }

  @Post()
  create(
    @Body() createCouponUsageDto: CreateCouponUsageDto,
  ) {
    return this.couponUsageService.create(
      createCouponUsageDto,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCouponUsageDto: UpdateCouponUsageDto,
  ) {
    return this.couponUsageService.update(
      id,
      updateCouponUsageDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.couponUsageService.remove(id);
  }
}
