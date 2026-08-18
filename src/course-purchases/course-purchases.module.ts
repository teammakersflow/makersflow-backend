import { Module } from '@nestjs/common';
import { CoursePurchasesService } from './course-purchases.service';
import { CoursePurchasesController } from './course-purchases.controller';

@Module({
  controllers: [CoursePurchasesController],
  providers: [CoursePurchasesService],
})
export class CoursePurchasesModule {}
