import { Test, TestingModule } from '@nestjs/testing';
import { BillingProfileService } from './billing-profile.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('BillingProfileService', () => {
  let service: BillingProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
  BillingProfileService,
  {
    provide: PrismaService,
    useValue: {},
  },
],
    }).compile();

    service = module.get<BillingProfileService>(BillingProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
