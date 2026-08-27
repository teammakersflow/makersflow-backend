import {
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateShippingAddressDto {
  @IsString()
  full_name!: string;

  @IsString()
  address_line1!: string;

  @IsOptional()
  @IsString()
  address_line2?: string;

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsString()
  postal_code!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}