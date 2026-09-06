import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { PushTokensService } from './push-tokens.service';

import { CreatePushTokenDto } from './dto/create-push-token.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CurrentUser } from '../auth/decorators/current-user.decorator';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('push-tokens')
@UseGuards(JwtAuthGuard)
export class PushTokensController {
  constructor(
    private readonly pushTokensService: PushTokensService,
  ) {}

  @Post()
  create(
    @Body() createPushTokenDto: CreatePushTokenDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pushTokensService.create(
      user.id,
      createPushTokenDto,
    );
  }

  @Get()
  findMyTokens(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pushTokensService.findMyTokens(user.id);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pushTokensService.remove(
      id,
      user.id,
    );
  }
}