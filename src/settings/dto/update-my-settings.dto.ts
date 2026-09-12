import {
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateMySettingsDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  school?: string;

  @IsOptional()
  @IsBoolean()
  notifications_enabled?: boolean;
}