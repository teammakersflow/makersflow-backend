import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';

import { LessonProgressService } from './lesson-progress.service';

import { CreateLessonProgressDto } from './dto/create-lesson-progress.dto';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('lesson-progress')
@UseGuards(JwtAuthGuard)
export class LessonProgressController {
  constructor(
    private readonly lessonProgressService: LessonProgressService,
  ) {}

  // =========================
  // STUDENT ROUTES
  // =========================

  @Get('my')
  findMyProgress(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonProgressService.findMyProgress(user.id);
  }

  @Get('my/course/:courseId')
  findMyCourseProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
  ) {
    return this.lessonProgressService.findMyCourseProgress(
      user.id,
      BigInt(courseId),
    );
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createLessonProgressDto: CreateLessonProgressDto,
  ) {
    return this.lessonProgressService.create(
      user.id,
      createLessonProgressDto,
    );
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateLessonProgressDto: UpdateLessonProgressDto,
  ) {
    return this.lessonProgressService.update(
      user.id,
      BigInt(id),
      updateLessonProgressDto,
    );
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.lessonProgressService.remove(
      user.id,
      BigInt(id),
    );
  }
}