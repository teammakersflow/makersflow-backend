import { Test, TestingModule } from '@nestjs/testing';
import { PromotionsService } from './promotions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PromotionsService', () => {
  let service: PromotionsService;

  beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
  providers: [
    PromotionsService,
    {
      provide: PrismaService,
      useValue: {},
    },
  ],
}).compile();

    service = module.get<PromotionsService>(PromotionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
