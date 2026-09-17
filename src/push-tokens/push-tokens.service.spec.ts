import { Test, TestingModule } from '@nestjs/testing';
import { PushTokensService } from './push-tokens.service';
import { PrismaService } from '../prisma/prisma.service';
describe('PushTokensService', () => {
  let service: PushTokensService;

  beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
  providers: [
    PushTokensService,
    {
      provide: PrismaService,
      useValue: {},
    },
  ],
}).compile();

    service = module.get<PushTokensService>(PushTokensService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
