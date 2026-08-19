import {
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateNewsDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

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