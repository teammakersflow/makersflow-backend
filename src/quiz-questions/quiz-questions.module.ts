import { Module } from '@nestjs/common';
import { QuizQuestionsService } from './quiz-questions.service';
import { QuizQuestionsController } from './quiz-questions.controller';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [EnrollmentsModule],
  controllers: [QuizQuestionsController],
  providers: [QuizQuestionsService],
})
export class QuizQuestionsModule {}