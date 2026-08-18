import { Test, TestingModule } from '@nestjs/testing';
import { CoursePurchasesService } from './course-purchases.service';

describe('CoursePurchasesService', () => {
  let service: CoursePurchasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoursePurchasesService],
    }).compile();

    service = module.get<CoursePurchasesService>(CoursePurchasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
