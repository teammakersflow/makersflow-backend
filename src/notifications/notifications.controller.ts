import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';

import type { Request } from 'express';

import { NotificationsService } from './notifications.service';

import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─────────────────────────────────────────────
  // STUDENT NOTIFICATIONS
  // ─────────────────────────────────────────────

  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMyNotifications(@Req() req: Request) {
    const user = req.user as any;

    return this.notificationsService.findMyNotifications(
      user.id,
    );
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  getUnreadCount(@Req() req: Request) {
    const user = req.user as any;

    return this.notificationsService.getUnreadCount(
      user.id,
    );
  }

  @Patch('my/:id/read')
  @UseGuards(JwtAuthGuard)
  markAsRead(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const user = req.user as any;

    return this.notificationsService.markAsRead(
      user.id,
      id,
    );
  }

  // ─────────────────────────────────────────────
  // ADMIN CRUD
  // ─────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(
    @Body() createNotificationDto: CreateNotificationDto,
  ) {
    return this.notificationsService.create(
      createNotificationDto,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.notificationsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.notificationsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ) {
    return this.notificationsService.update(
      id,
      updateNotificationDto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }
}