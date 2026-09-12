import { IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateRazorpayOrderDto {
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  receipt?: string;

  @IsOptional()
  @IsObject()
  items?: Record<string, any>;

  @IsOptional()
  @IsObject()
  shipping_address?: Record<string, any>;

  @IsOptional()
  @IsString()
  order_type?: string;
}
