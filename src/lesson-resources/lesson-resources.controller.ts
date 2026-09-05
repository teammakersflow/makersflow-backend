import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';

import { LessonResourcesService } from './lesson-resources.service';
import { CreateLessonResourceDto } from './dto/create-lesson-resource.dto';
import { UpdateLessonResourceDto } from './dto/update-lesson-resource.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
@Controller('lesson-resources')
export class LessonResourcesController {
  constructor(
    private readonly lessonResourcesService: LessonResourcesService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() createLessonResourceDto: CreateLessonResourceDto) {
    return this.lessonResourcesService.create(createLessonResourceDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findByLessonQuery(
    @Query('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonResourcesService.findByLessonForStudent(
      BigInt(lessonId),
      user.id,
    );
  }

  @Get('lesson/:lessonId')
  @UseGuards(JwtAuthGuard)
  findByLesson(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonResourcesService.findByLessonForStudent(
      BigInt(lessonId),
      user.id,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonResourcesService.findOneForStudent(
      id,
      user.id,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateLessonResourceDto: UpdateLessonResourceDto,
  ) {
    return this.lessonResourcesService.update(
      id,
      updateLessonResourceDto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lessonResourcesService.remove(id);
  }
}