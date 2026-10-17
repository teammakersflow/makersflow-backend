
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

import { QuizAttemptsService } from './quiz-attempts.service';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@Controller('quiz-attempts')
@UseGuards(JwtAuthGuard)
export class QuizAttemptsController {
  constructor(
    private readonly quizAttemptsService: QuizAttemptsService,
  ) {}

  @Get('me')
  findMyAttempts(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizAttemptsService.findAll(user.id);
  }

  @Post('submit')
  submitQuiz(
    @Body() dto: SubmitQuizDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizAttemptsService.submit(
      user.id,
      dto.lesson_id,
      dto.answers,
    );
  }
}
