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

@Controller('lesson-progress')
export class LessonProgressController {
  constructor(
    private readonly lessonProgressService: LessonProgressService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createLessonProgressDto: CreateLessonProgressDto) {
    return this.lessonProgressService.create(createLessonProgressDto);
  }

  @Get()
  findAll() {
    return this.lessonProgressService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lessonProgressService.findOne(BigInt(id));
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateLessonProgressDto: UpdateLessonProgressDto,
  ) {
    return this.lessonProgressService.update(
      BigInt(id),
      updateLessonProgressDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lessonProgressService.remove(BigInt(id));
  }
}