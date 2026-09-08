import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';

describe('WaitlistController', () => {
  let controller: WaitlistController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaitlistController],
      providers: [
        {
          provide: WaitlistService,
          useValue: {
            register: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WaitlistController>(WaitlistController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});