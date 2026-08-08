import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateCouponDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  discount_type!: string;

  @IsNumber()
  discount_value!: number;

  @IsOptional()
  @IsNumber()
  minimum_order_amount?: number;

  @IsOptional()
  @IsNumber()
  maximum_discount?: number;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;

  @IsOptional()
  @IsInt()
  usage_limit?: number;

  @IsOptional()
  @IsInt()
  usage_count?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  applicable_to?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicable_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicable_course_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicable_product_ids?: string[];

  @IsOptional()
  @IsNumber()
  max_discount_amount?: number;

  @IsOptional()
  @IsNumber()
  min_order_amount?: number;

  @IsOptional()
  @IsInt()
  used_count?: number;

  @IsOptional()
  @IsUUID()
  created_by?: string;
}