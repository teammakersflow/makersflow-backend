import { Module } from '@nestjs/common';

import { CourseFavoritesService } from './course-favorites.service';
import { CourseFavoritesController } from './course-favorites.controller';

@Module({
  controllers: [CourseFavoritesController],
  providers: [CourseFavoritesService],
})
export class CourseFavoritesModule {}
