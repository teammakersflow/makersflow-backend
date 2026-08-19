import { Module } from '@nestjs/common';

import { CouponUsageController } from './coupon-usage.controller';
import { CouponUsageService } from './coupon-usage.service';

@Module({
  controllers: [CouponUsageController],
  providers: [CouponUsageService],
})
export class CouponUsageModule {}
