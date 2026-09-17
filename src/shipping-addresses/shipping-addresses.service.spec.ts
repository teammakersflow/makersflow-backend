import { Test, TestingModule } from '@nestjs/testing';
import { ShippingAddressesService } from './shipping-addresses.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('ShippingAddressesService', () => {
  let service: ShippingAddressesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
  ShippingAddressesService,
  {
    provide: PrismaService,
    useValue: {},
  },
],
    }).compile();

    service = module.get<ShippingAddressesService>(ShippingAddressesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
