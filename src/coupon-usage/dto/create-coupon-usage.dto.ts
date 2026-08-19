import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateCouponUsageDto {
  @IsNotEmpty()
  @IsUUID()
  coupon_id!: string;

  @IsNotEmpty()
  @IsUUID()
  user_id!: string;

  @IsOptional()
  @IsUUID()
  order_id?: string;

  @IsOptional()
  @IsNumber()
  discount_amount?: number;

  @IsOptional()
  @IsDateString()
  used_at?: string;
}