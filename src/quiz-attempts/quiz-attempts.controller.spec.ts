import { Test, TestingModule } from '@nestjs/testing';
import { QuizAttemptsController } from './quiz-attempts.controller';
import { QuizAttemptsService } from './quiz-attempts.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';

describe('QuizAttemptsController', () => {
  let controller: QuizAttemptsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizAttemptsController],
      providers: [
  QuizAttemptsService,
  {
    provide: PrismaService,
    useValue: {},
  },
  { provide: EnrollmentsService, useValue: { findMyEnrollment: jest.fn() } },
],
    }).compile();

    controller = module.get<QuizAttemptsController>(QuizAttemptsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
