import { Module } from '@nestjs/common';

import { LessonNotesController } from './lesson-notes.controller';
import { LessonNotesService } from './lesson-notes.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [EnrollmentsModule],
  controllers: [LessonNotesController],
  providers: [LessonNotesService],
})
export class LessonNotesModule {}