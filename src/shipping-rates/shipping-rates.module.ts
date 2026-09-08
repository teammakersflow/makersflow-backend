import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ShippingRatesController } from './shipping-rates.controller';
import { ShippingRatesService } from './shipping-rates.service';

@Module({
  imports: [ConfigModule],
  controllers: [ShippingRatesController],
  providers: [ShippingRatesService],
})
export class ShippingRatesModule {}