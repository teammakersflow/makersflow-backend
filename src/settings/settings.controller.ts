import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Public/read route — leave unguarded
  @Get()
  findAll(@Query('keys') keys?: string) {
    const parsedKeys = keys
      ? keys
          .split(',')
          .map((key) => key.trim())
          .filter(Boolean)
      : undefined;

    return this.settingsService.findAll(parsedKeys);
  }

  // Admin only
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  upsert(@Body() createSettingDto: CreateSettingDto) {
    return this.settingsService.upsert(createSettingDto);
  }

  // Admin only
  @Post('upsert')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  upsertExplicit(@Body() createSettingDto: CreateSettingDto) {
    return this.settingsService.upsert(createSettingDto);
  }

    @Get('me')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('student', 'admin')
    getMySettings(@CurrentUser() currentUser: { id: string }) {
      return this.settingsService.getMySettings(currentUser.id);
    }

  // Public/read route — leave unguarded
  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  // Admin only
  @Patch(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('key') key: string,
    @Body() updateSettingDto: UpdateSettingDto,
  ) {
    return this.settingsService.update(key, updateSettingDto);
  }

  // Admin only
  @Delete(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('key') key: string) {
    return this.settingsService.remove(key);
  }
}