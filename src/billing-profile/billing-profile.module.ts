import { Module } from '@nestjs/common';
import { BillingProfileService } from './billing-profile.service';
import { BillingProfileController } from './billing-profile.controller';

@Module({
  controllers: [BillingProfileController],
  providers: [BillingProfileService],
})
export class BillingProfileModule {}
