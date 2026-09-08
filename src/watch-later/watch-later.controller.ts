import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth } from '@nestjs/swagger';

import { WatchLaterService } from './watch-later.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('watch-later')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class WatchLaterController {
  constructor(
    private readonly watchLaterService: WatchLaterService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.watchLaterService.findAll(user.id);
  }

  @Post(':courseId')
  add(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.watchLaterService.add(
      user.id,
      BigInt(courseId),
    );
  }

  @Delete(':courseId')
  remove(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.watchLaterService.remove(
      user.id,
      BigInt(courseId),
    );
  }
}
