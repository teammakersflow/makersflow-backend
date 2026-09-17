import { Test, TestingModule } from '@nestjs/testing';
import { LessonResourcesService } from './lesson-resources.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';

describe('LessonResourcesService', () => {
  let service: LessonResourcesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonResourcesService,
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

    service = module.get<LessonResourcesService>(LessonResourcesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});