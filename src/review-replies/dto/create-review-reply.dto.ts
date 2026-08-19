import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateReviewReplyDto {
  @IsUUID()
  review_id!: string;

  @IsNotEmpty()
  @IsString()
  content!: string;
}
