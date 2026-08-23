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

import { LessonResourcesService } from './lesson-resources.service';

import { CreateLessonResourceDto } from './dto/create-lesson-resource.dto';

import { UpdateLessonResourceDto } from './dto/update-lesson-resource.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { RolesGuard } from '../auth/guards/roles.guard';

import { Roles } from '../auth/decorators/roles.decorator';

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
  findAll() {
    return this.lessonResourcesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lessonResourcesService.findOne(id);
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