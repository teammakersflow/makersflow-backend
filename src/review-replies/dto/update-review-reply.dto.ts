import { PartialType } from '@nestjs/mapped-types';
import { CreateReviewReplyDto } from './create-review-reply.dto';

export class UpdateReviewReplyDto extends PartialType(
  CreateReviewReplyDto,
) {}
