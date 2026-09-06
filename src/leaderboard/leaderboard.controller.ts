import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(
    private readonly leaderboardService: LeaderboardService,
  ) {}

  @Get()
  findAll() {
    return this.leaderboardService.findAll();
  }
}