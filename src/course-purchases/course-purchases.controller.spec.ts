import { Test, TestingModule } from '@nestjs/testing';
import { CoursePurchasesController } from './course-purchases.controller';
import { CoursePurchasesService } from './course-purchases.service';

describe('CoursePurchasesController', () => {
  let controller: CoursePurchasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursePurchasesController],
      providers: [CoursePurchasesService],
    }).compile();

    controller = module.get<CoursePurchasesController>(CoursePurchasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
