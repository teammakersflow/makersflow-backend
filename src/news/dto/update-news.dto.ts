import {
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class UpdateNewsDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUrl()
  thumbnail_url?: string;
}