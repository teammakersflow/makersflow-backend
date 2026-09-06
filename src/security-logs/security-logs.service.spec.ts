import { Test, TestingModule } from '@nestjs/testing';
import { SecurityLogsService } from './security-logs.service';

describe('SecurityLogsService', () => {
  let service: SecurityLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SecurityLogsService],
    }).compile();

    service = module.get<SecurityLogsService>(SecurityLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
