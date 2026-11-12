import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';

import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

function parseLessonId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new BadRequestException('Invalid lesson ID');
  }
  return BigInt(id);
}

@Controller('lessons')
@ApiBearerAuth()
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() createLessonDto: CreateLessonDto) {
    return this.lessonsService.create(createLessonDto);
  }

  // B-1 (2026-11-11): was public and returned every column (video_url,
  // content) of every lesson. Anonymous callers now get curriculum metadata
  // only; see LessonsService.findAllForCaller for the full policy.
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(@CurrentUser() user: AuthenticatedUser | null) {
    return this.lessonsService.findAllForCaller(user);
  }

  @Get(':id/video')
  @UseGuards(JwtAuthGuard)
  async getVideoUrl(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('Invalid lesson ID');
    }

    return this.lessonsService.getVideoUrlForStudent(
      BigInt(id),
      user.id,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.findOneForCaller(
      parseLessonId(id),
      user,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() updateLessonDto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(
      BigInt(id),
      updateLessonDto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.lessonsService.remove(BigInt(id));
  }
}