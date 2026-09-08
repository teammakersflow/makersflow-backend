import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ShippingRatesService } from './shipping-rates.service';
import { ShippingRateDto } from './dto/shipping-rate.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('shipping')
export class ShippingRatesController {
  constructor(
    private readonly shippingRatesService: ShippingRatesService,
  ) {}

  @Post('rates')
  @UseGuards(JwtAuthGuard)
  getRates(@Body() dto: ShippingRateDto) {
    return this.shippingRatesService.getRates(dto);
  }
}