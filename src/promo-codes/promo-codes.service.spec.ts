import { Test, TestingModule } from '@nestjs/testing';
import { PromoCodesService } from './promo-codes.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('PromoCodesService', () => {
  let service: PromoCodesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
  PromoCodesService,
  {
    provide: PrismaService,
    useValue: {},
  },
],
    }).compile();

    service = module.get<PromoCodesService>(PromoCodesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
