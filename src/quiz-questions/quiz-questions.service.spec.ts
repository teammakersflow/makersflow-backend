import { Test, TestingModule } from '@nestjs/testing';
import { QuizQuestionsService } from './quiz-questions.service';
import { EnrollmentsService } from 'src/enrollments/enrollments.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('QuizQuestionsService', () => {
  let service: QuizQuestionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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

    service = module.get<QuizQuestionsService>(QuizQuestionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
