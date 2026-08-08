import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';

export enum PaymentStatus {
  PENDING = 'pending',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export class CreatePaymentDto {
  @IsString()
  user_id!: string;

  @IsString()
  razorpay_order_id!: string;

  @IsOptional()
  @IsString()
  razorpay_payment_id?: string;

  @IsOptional()
  @IsString()
  razorpay_signature?: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  failure_reason?: string;

  @IsOptional()
  @IsString()
  refund_id?: string;

  @IsOptional()
  @IsNumber()
  refund_amount?: number;

  @IsOptional()
  @IsDateString()
  refunded_at?: string;

  @IsOptional()
  @IsString()
  failure_code?: string;

  @IsOptional()
  @IsString()
  failure_description?: string;
}