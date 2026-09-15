import { Test, TestingModule } from '@nestjs/testing';
import { LessonProgressController } from './lesson-progress.controller';
import { LessonProgressService } from './lesson-progress.service';

describe('LessonProgressController', () => {
  let controller: LessonProgressController;

  beforeEach(async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [LessonProgressController],
        providers: [
          {
            provide: LessonProgressService,
            useValue: {
              findMyProgress: jest.fn(),
              findMyCourseProgress: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              remove: jest.fn(),
            },
          },
        ],
      }).compile();

    controller = module.get<LessonProgressController>(
      LessonProgressController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});