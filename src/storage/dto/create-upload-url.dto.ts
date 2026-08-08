import { IsIn, IsString } from 'class-validator';

export class CreateUploadUrlDto {
  @IsString()
  fileName!: string;

  @IsString()
  contentType!: string;

  @IsIn(['courses', 'products', 'uploads'])
  folder!: 'courses' | 'products' | 'uploads';
}