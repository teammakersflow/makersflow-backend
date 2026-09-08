import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    EnrollmentsModule,
    StorageModule,
  ],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}