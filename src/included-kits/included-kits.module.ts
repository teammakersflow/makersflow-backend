import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ShippingAddressesModule } from '../shipping-addresses/shipping-addresses.module';
import { ShippingRatesModule } from '../shipping-rates/shipping-rates.module';
import { StorageModule } from '../storage/storage.module';
import { IncludedKitsController } from './included-kits.controller';
import { IncludedKitsService } from './included-kits.service';

@Module({
  imports: [
    ConfigModule,
    ShippingAddressesModule,
    ShippingRatesModule,
    StorageModule,
  ],
  controllers: [IncludedKitsController],
  providers: [IncludedKitsService],
  exports: [IncludedKitsService],
})
export class IncludedKitsModule {}