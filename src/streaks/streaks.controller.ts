import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { StreaksService } from './streaks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('streaks')
@UseGuards(JwtAuthGuard)
export class StreaksController {
  constructor(
    private readonly streaksService: StreaksService,
  ) {}

  @Get('me')
  findMyStreak(@CurrentUser() user: AuthenticatedUser) {
    return this.streaksService.findMyStreak(user.id);
  }
}