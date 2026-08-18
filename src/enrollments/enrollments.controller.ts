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

import { EnrollmentsService } from './enrollments.service';

import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { RolesGuard } from '../auth/guards/roles.guard';

import { Roles } from '../auth/decorators/roles.decorator';

@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class EnrollmentsController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @Post()
  create(@Body() createEnrollmentDto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(
      createEnrollmentDto,
    );
  }

  @Get()
  findAll(@Query('include') include?: string) {
    const includes =
      include
        ?.split(',')
        .map((item) => item.trim()) ?? [];

    const includeUser = includes.includes('user');
    const includeCourse = includes.includes('course');

    return this.enrollmentsService.findAll(
      includeUser,
      includeCourse,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.enrollmentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEnrollmentDto: UpdateEnrollmentDto,
  ) {
    return this.enrollmentsService.update(
      id,
      updateEnrollmentDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.enrollmentsService.remove(id);
  }
}