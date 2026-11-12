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

import { ModulesService } from './modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('modules')
export class ModulesController {
  constructor(
    private readonly modulesService: ModulesService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() createModuleDto: CreateModuleDto) {
    return this.modulesService.create(createModuleDto);
  }

  // B-1 (2026-11-11): module rows are curriculum metadata (title, order,
  // description, duration) and stay public so course pages can be browsed.
  // The service now uses an explicit field list so a future sensitive column
  // is never exposed by accident.
  @Get()
  findAll() {
    return this.modulesService.findAllPublic();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('Invalid module ID');
    }
    return this.modulesService.findOnePublic(BigInt(id));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() updateModuleDto: UpdateModuleDto,
  ) {
    return this.modulesService.update(
      BigInt(id),
      updateModuleDto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.modulesService.remove(BigInt(id));
  }
}