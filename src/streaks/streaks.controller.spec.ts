import { Test, TestingModule } from '@nestjs/testing';
import { StreaksController } from './streaks.controller';
import { StreaksService } from './streaks.service';

describe('StreaksController', () => {
  let controller: StreaksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StreaksController],
      providers: [StreaksService],
    }).compile();

    controller = module.get<StreaksController>(StreaksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
