import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class ValidateCouponDto {
  @IsString()
  code!: string;

  @IsNumber()
  order_amount!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  course_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  product_ids?: string[];
}