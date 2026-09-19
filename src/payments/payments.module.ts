import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StorageModule } from '../storage/storage.module';
import { CouponsModule } from '../coupons/coupons.module';
import { ShippingRatesModule } from '../shipping-rates/shipping-rates.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    StorageModule,
    CouponsModule,
    ShippingRatesModule,
    EnrollmentsModule,
    ProductsModule
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
