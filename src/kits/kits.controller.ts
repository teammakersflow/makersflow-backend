import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KitsService } from './kits.service';
import { CreateKitDto, SetCourseKitDto, UpdateKitDto } from './dto/kit.dto';

@Controller('kits')
@ApiBearerAuth()
export class KitsController {
  constructor(private readonly kits: KitsService) {}

  // Public: the website and app call this on the course details page
  @Get('course/:courseId')
  getCourseKit(@Param('courseId') courseId: string) {
    return this.kits.getCourseKit(courseId);
  }

  // Admin only from here down
  @Put('course/:courseId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  setCourseKit(@Param('courseId') courseId: string, @Body() dto: SetCourseKitDto) {
    return this.kits.setCourseKit(courseId, dto.kit_id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateKitDto) {
    return this.kits.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.kits.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.kits.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateKitDto) {
    return this.kits.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.kits.remove(id);
  }
}