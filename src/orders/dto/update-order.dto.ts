import {
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  tracking_number?: string;

  @IsOptional()
  @IsString()
  shipment_status?: string;

  @IsOptional()
  @IsDateString()
  estimated_delivery?: string;
}