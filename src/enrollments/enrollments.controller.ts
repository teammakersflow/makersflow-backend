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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() createEnrollmentDto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(
      createEnrollmentDto,
    );
  }

@Get()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
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

@Get('my')
@UseGuards(JwtAuthGuard)
findMyEnrollments(
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.enrollmentsService.findMyEnrollments(
    user.id,
  );
}

@Get('my/:courseId')
@UseGuards(JwtAuthGuard)
findMyEnrollment(
  @CurrentUser() user: AuthenticatedUser,
  @Param('courseId') courseId: string,
) {
  return this.enrollmentsService.findMyEnrollment(
    user.id,
    BigInt(courseId),
  );
}

@Post('free')
@UseGuards(JwtAuthGuard)
enrollInFreeCourse(
  @CurrentUser() user: AuthenticatedUser,
  @Body('course_id') courseId: number,
) {
  return this.enrollmentsService.enrollInFreeCourse(
    user.id,
    BigInt(courseId),
  );
}

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.enrollmentsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.enrollmentsService.remove(id);
  }
}