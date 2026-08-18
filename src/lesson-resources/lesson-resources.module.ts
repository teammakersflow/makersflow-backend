import { Module } from '@nestjs/common';
import { LessonResourcesService } from './lesson-resources.service';
import { LessonResourcesController } from './lesson-resources.controller';

@Module({
  controllers: [LessonResourcesController],
  providers: [LessonResourcesService],
})
export class LessonResourcesModule {}
