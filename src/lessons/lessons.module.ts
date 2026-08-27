import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [EnrollmentsModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}