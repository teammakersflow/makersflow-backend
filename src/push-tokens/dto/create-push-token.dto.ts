import { IsOptional, IsString } from 'class-validator';

export class CreatePushTokenDto {
  @IsString()
  token!: string;

  @IsString()
  platform!: string;

  @IsOptional()
  @IsString()
  device_info?: string;
}