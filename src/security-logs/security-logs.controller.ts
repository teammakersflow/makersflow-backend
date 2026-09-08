import {
  Controller,
  Get,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';

import { SecurityLogsService } from './security-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('users/me/security-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class SecurityLogsController {
  constructor(
    private readonly securityLogsService: SecurityLogsService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.securityLogsService.findAll(user.id);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.securityLogsService.remove(id, user.id);
  }
}