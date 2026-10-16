import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  IsNotEmpty,
} from 'class-validator';

export class CreateRazorpayOrderDto {
  @IsOptional()
  @IsString()
  course_id?: string;
  /**
   * Kept temporarily for frontend compatibility.
   * The backend must NOT trust this value.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  currency?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  receipt?: string;

  /**
   * Example:
   * [
   *   { "productId": "1", "quantity": 2 },
   *   { "productId": "5", "quantity": 1 }
   * ]
   */
  @IsOptional()
  @IsArray()
  items?: Array<{
    productId: string | number;
    quantity: number;
  }>;

  @IsOptional()
  @IsObject()
  shipping_address?: Record<string, any>;

  @IsOptional()
  @IsString()
  order_type?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  coupon_code?: string;
}