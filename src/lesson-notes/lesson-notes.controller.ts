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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('lesson-notes')
@ApiBearerAuth()
export class LessonNotesController {
  constructor(
    private readonly lessonNotesService: LessonNotesService,
  ) {}

  @Get('lesson/:lessonId')
  @UseGuards(JwtAuthGuard)
  findByLesson(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonNotesService.findByLessonForStudent(
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
    return this.lessonNotesService.findOneForStudent(
      id,
      user.id,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  create(
    @Body() createLessonNoteDto: CreateLessonNoteDto,
  ) {
    return this.lessonNotesService.create(
      createLessonNoteDto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lessonNotesService.remove(id);
  }
}