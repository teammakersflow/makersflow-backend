import { Module } from '@nestjs/common';

import { ReviewRepliesController } from './review-replies.controller';
import { ReviewRepliesService } from './review-replies.service';

@Module({
  controllers: [ReviewRepliesController],
  providers: [ReviewRepliesService],
})
export class ReviewRepliesModule {}
