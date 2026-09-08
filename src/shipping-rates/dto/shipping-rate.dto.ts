import {
  IsNumber,
  IsString,
  Min,
} from 'class-validator';

export class ShippingRateDto {
  @IsString()
  pickup_postcode!: string;

  @IsString()
  delivery_postcode!: string;

  @IsNumber()
  @Min(0.1)
  weight!: number;

  @IsString()
  product_type!: string;
}