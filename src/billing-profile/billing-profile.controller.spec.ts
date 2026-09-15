import { Test, TestingModule } from '@nestjs/testing';
import { BillingProfileController } from './billing-profile.controller';
import { BillingProfileService } from './billing-profile.service';

describe('BillingProfileController', () => {
  let controller: BillingProfileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingProfileController],
      providers: [BillingProfileService],
    }).compile();

    controller = module.get<BillingProfileController>(BillingProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
