import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth } from '@nestjs/swagger';

import { LessonNotesService } from './lesson-notes.service';
import { CreateLessonNoteDto } from './dto/create-lesson-note.dto';
import { UpdateLessonNoteDto } from './dto/update-lesson-note.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('lesson-notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class LessonNotesController {
  constructor(
    private readonly lessonNotesService: LessonNotesService,
  ) {}

  @Get()
  findAll() {
    return this.lessonNotesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lessonNotesService.findOne(id);
  }

  @Post()
  create(
    @Body() createLessonNoteDto: CreateLessonNoteDto,
  ) {
    return this.lessonNotesService.create(
      createLessonNoteDto,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateLessonNoteDto: UpdateLessonNoteDto,
  ) {
    return this.lessonNotesService.update(
      id,
      updateLessonNoteDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lessonNotesService.remove(id);
  }
}