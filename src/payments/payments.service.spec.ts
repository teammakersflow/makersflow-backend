import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { ProductsService } from '../products/products.service';

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,

        {
          provide: PrismaService,
          useValue: {},
        },

        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'RAZORPAY_KEY_ID') {
                return 'test_key_id';
              }

              if (key === 'RAZORPAY_KEY_SECRET') {
                return 'test_key_secret';
              }

              return undefined;
            }),
          },
        },

        {
          provide: StorageService,
          useValue: {},
        },

        {
          provide: EnrollmentsService,
          useValue: {},
        },

        {
          provide: ProductsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});