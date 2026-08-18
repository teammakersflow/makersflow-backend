import { Test, TestingModule } from '@nestjs/testing';
import { LessonResourcesController } from './lesson-resources.controller';
import { LessonResourcesService } from './lesson-resources.service';

describe('LessonResourcesController', () => {
  let controller: LessonResourcesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LessonResourcesController],
      providers: [LessonResourcesService],
    }).compile();

    controller = module.get<LessonResourcesController>(LessonResourcesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
