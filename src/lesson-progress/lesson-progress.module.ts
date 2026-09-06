import { Module } from '@nestjs/common';

import { LessonProgressController } from './lesson-progress.controller';
import { LessonProgressService } from './lesson-progress.service';
import { StreaksModule } from '../streaks/streaks.module';

@Module({
  imports: [StreaksModule],
  controllers: [LessonProgressController],
  providers: [LessonProgressService],
})
export class LessonProgressModule {}