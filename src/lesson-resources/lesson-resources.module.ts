import { Module } from '@nestjs/common';
import { LessonResourcesService } from './lesson-resources.service';
import { LessonResourcesController } from './lesson-resources.controller';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [EnrollmentsModule],
  controllers: [LessonResourcesController],
  providers: [LessonResourcesService],
})
export class LessonResourcesModule {}