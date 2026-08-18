import { Module } from '@nestjs/common';
import { LessonProgressService } from './lesson-progress.service';
import { LessonProgressController } from './lesson-progress.controller';

@Module({
  controllers: [LessonProgressController],
  providers: [LessonProgressService],
})
export class LessonProgressModule {}
