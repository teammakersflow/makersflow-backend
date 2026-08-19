import {
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  link_url?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  scheduled_at?: string;
}