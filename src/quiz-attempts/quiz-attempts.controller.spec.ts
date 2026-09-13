import { Test, TestingModule } from '@nestjs/testing';
import { QuizAttemptsController } from './quiz-attempts.controller';
import { QuizAttemptsService } from './quiz-attempts.service';

describe('QuizAttemptsController', () => {
  let controller: QuizAttemptsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizAttemptsController],
      providers: [QuizAttemptsService],
    }).compile();

    controller = module.get<QuizAttemptsController>(QuizAttemptsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
