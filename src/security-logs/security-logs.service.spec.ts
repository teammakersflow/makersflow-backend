import { Test, TestingModule } from '@nestjs/testing';
import { SecurityLogsService } from './security-logs.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('SecurityLogsService', () => {
  let service: SecurityLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
  SecurityLogsService,
  {
    provide: PrismaService,
    useValue: {},
  },
],
    }).compile();

    service = module.get<SecurityLogsService>(SecurityLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
