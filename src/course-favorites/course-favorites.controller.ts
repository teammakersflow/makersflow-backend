import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth } from '@nestjs/swagger';

import { CourseFavoritesService } from './course-favorites.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('course-favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class CourseFavoritesController {
  constructor(
    private readonly courseFavoritesService: CourseFavoritesService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.courseFavoritesService.findAll(user.id);
  }

  @Post(':courseId')
  add(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courseFavoritesService.add(
      user.id,
      BigInt(courseId),
    );
  }

  @Delete(':courseId')
  remove(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courseFavoritesService.remove(
      user.id,
      BigInt(courseId),
    );
  }
}
