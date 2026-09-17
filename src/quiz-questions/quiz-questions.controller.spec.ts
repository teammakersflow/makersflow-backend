import { Test, TestingModule } from '@nestjs/testing';
import { QuizQuestionsController } from './quiz-questions.controller';
import { QuizQuestionsService } from './quiz-questions.service';
import { EnrollmentsService } from 'src/enrollments/enrollments.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('QuizQuestionsController', () => {
  let controller: QuizQuestionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizQuestionsController],
      providers: [
  QuizQuestionsService,
  {
    provide: PrismaService,
    useValue: {},
  },
  {
    provide: EnrollmentsService,
    useValue: {},
  },
],
    }).compile();

    controller = module.get<QuizQuestionsController>(QuizQuestionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
