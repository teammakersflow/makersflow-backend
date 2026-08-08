import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsUUID,
} from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID()
  user_id!: string;

  @IsNumber()
  course_id!: number;

  @IsOptional()
  @IsString()
  payment_status?: string;

  @IsOptional()
  @IsString()
  razorpay_order_id?: string;

  @IsOptional()
  @IsDateString()
  completed_at?: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string;
}