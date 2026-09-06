import { Test, TestingModule } from '@nestjs/testing';
import { SecurityLogsController } from './security-logs.controller';
import { SecurityLogsService } from './security-logs.service';

describe('SecurityLogsController', () => {
  let controller: SecurityLogsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityLogsController],
      providers: [SecurityLogsService],
    }).compile();

    controller = module.get<SecurityLogsController>(SecurityLogsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
