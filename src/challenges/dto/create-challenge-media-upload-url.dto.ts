import { IsIn, IsString } from 'class-validator';

export class CreateChallengeMediaUploadUrlDto {
  @IsString()
  fileName!: string;

  @IsString()
  @IsIn([
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
  ])
  contentType!: string;
}