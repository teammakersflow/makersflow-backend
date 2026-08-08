import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsObject,
} from 'class-validator';

export class CreateOrderDto {
  @IsString()
  user_id!: string;

  @IsNumber()
  total_amount!: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsObject()
  shipping_address?: Record<string, any>;

  @IsOptional()
  @IsString()
  payment_id?: string;

  @IsOptional()
  @IsString()
  coupon_id?: string;

  @IsOptional()
  @IsString()
  coupon_code?: string;

  @IsOptional()
  @IsNumber()
  discount_amount?: number;

  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @IsOptional()
  @IsString()
  order_type?: string;

  @IsNumber()
  tax_amount!: number;

  @IsOptional()
  @IsString()
  invoice_url?: string;

  @IsOptional()
  @IsObject()
  items?: Record<string, any>;

  @IsOptional()
  @IsString()
  tracking_number?: string;

  @IsOptional()
  @IsDateString()
  estimated_delivery?: string;

  @IsOptional()
  @IsString()
  shipment_status?: string;

  // NEW FIELDS

  @IsOptional()
  @IsString()
  razorpay_id?: string;

  @IsOptional()
  @IsString()
  razorpay_order_id?: string;

  @IsOptional()
  @IsString()
  razorpay_payment_id?: string;

  @IsOptional()
  @IsString()
  promo_code?: string;

  @IsOptional()
  @IsString()
  refund_id?: string;
}