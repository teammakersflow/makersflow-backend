import { Test, TestingModule } from '@nestjs/testing';
import { LessonProgressService } from './lesson-progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { StreaksService } from '../streaks/streaks.service';

describe('LessonProgressService', () => {
  let service: LessonProgressService;

  beforeEach(async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          LessonProgressService,
          {
            provide: PrismaService,
            useValue: {},
          },
          {
            provide: StreaksService,
            useValue: {
              recordActivity: jest.fn(),
            },
          },
        ],
      }).compile();

    service = module.get<LessonProgressService>(
      LessonProgressService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});