import { Test, TestingModule } from '@nestjs/testing';
import { BillingProfileService } from './billing-profile.service';

describe('BillingProfileService', () => {
  let service: BillingProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BillingProfileService],
    }).compile();

    service = module.get<BillingProfileService>(BillingProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
