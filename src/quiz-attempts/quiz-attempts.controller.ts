import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { QuizAttemptsService } from './quiz-attempts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('quiz-attempts')
@UseGuards(JwtAuthGuard)
export class QuizAttemptsController {
  constructor(
    private readonly quizAttemptsService: QuizAttemptsService,
  ) {}

  @Get('me')
  getMyAttempts(@CurrentUser() user: AuthenticatedUser) {
    return this.quizAttemptsService.getMyAttempts(user.id);
  }
}