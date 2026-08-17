import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateSettingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  value?: string;

  @IsOptional()
  @IsString()
  label?: string;
}