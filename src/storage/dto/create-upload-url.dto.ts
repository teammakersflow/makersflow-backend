import { IsIn, IsString } from 'class-validator';

export class CreateUploadUrlDto {
  @IsString()
  fileName!: string;

  @IsString()
  contentType!: string;

  @IsIn([
    'courses',
    'products',
    'lessons',
    'resources',
    'uploads',
    'news',
    'avatars',
  ])
  folder!:
    | 'courses'
    | 'products'
    | 'lessons'
    | 'resources'
    | 'uploads'
    | 'news'
    | 'avatars';
}