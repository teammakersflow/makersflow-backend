import { PartialType } from '@nestjs/mapped-types';
import { CreateCouponUsageDto } from './create-coupon-usage.dto';

export class UpdateCouponUsageDto extends PartialType(
  CreateCouponUsageDto,
) {}
