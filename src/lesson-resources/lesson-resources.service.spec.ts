import { Test, TestingModule } from '@nestjs/testing';
import { LessonResourcesService } from './lesson-resources.service';

describe('LessonResourcesService', () => {
  let service: LessonResourcesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LessonResourcesService],
    }).compile();

    service = module.get<LessonResourcesService>(LessonResourcesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
