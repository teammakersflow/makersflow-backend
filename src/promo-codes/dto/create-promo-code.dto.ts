import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePromoCodeDto {
  @IsString()
  code!: string;

  @IsInt()
  discount_percent!: number;

  @IsOptional()
  @IsDateString()
  expiry_at?: string;

  @IsOptional()
  @IsInt()
  usage_limit?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsNumber()
  min_order_amount?: number;

  @IsOptional()
  @IsNumber()
  max_discount_amount?: number;

  @IsArray()
  @IsString({ each: true })
  applicable_course_ids!: string[];

  @IsArray()
  @IsString({ each: true })
  applicable_product_ids!: string[];
}