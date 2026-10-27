import { StorageService } from '../storage/storage.service';
import { Test, TestingModule } from '@nestjs/testing';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EnrollmentsController', () => {
  let controller: EnrollmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentsController],
      providers: [
        { provide: StorageService, useValue: { createSignedImageUrl: jest.fn(async (u: string) => u) } },
        EnrollmentsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<EnrollmentsController>(
      EnrollmentsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});