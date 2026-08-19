import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  subtitle?: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  image_url: string;

  @IsString()
  @IsOptional()
  action_url?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsDateString()
  @IsOptional()
  expires_at?: string;

  @IsString()
  @IsOptional()
  link?: string;

  @IsInt()
  @IsOptional()
  display_order?: number;
}