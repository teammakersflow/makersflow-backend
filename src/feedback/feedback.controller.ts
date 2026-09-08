import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService,
  ) {}

  @Post()
  create(
    @Body() createFeedbackDto: CreateFeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.create(
      user.id,
      createFeedbackDto,
    );
  }
}