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

import { CoursePurchasesService } from './course-purchases.service';
import { CreateCoursePurchaseDto } from './dto/create-course-purchase.dto';
import { UpdateCoursePurchaseDto } from './dto/update-course-purchase.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('course-purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class CoursePurchasesController {
  constructor(
    private readonly coursePurchasesService: CoursePurchasesService,
  ) {}

  @Post()
  create(@Body() createCoursePurchaseDto: CreateCoursePurchaseDto) {
    return this.coursePurchasesService.create(
      createCoursePurchaseDto,
    );
  }

  @Get()
  findAll() {
    return this.coursePurchasesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursePurchasesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCoursePurchaseDto: UpdateCoursePurchaseDto,
  ) {
    return this.coursePurchasesService.update(
      id,
      updateCoursePurchaseDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coursePurchasesService.remove(id);
  }
}