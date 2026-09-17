import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProductsService', () => {
  let service: ProductsService;

  const prismaMock = {
    products: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deductStock', () => {
    it('should deduct stock when sufficient stock exists', async () => {
      prismaMock.products.updateMany.mockResolvedValue({
        count: 1,
      });

      prismaMock.products.findUnique.mockResolvedValue({
        id: BigInt(1),
        stock_quantity: 8,
      });

      const result = await service.deductStock(
        BigInt(1),
        2,
      );

      expect(prismaMock.products.updateMany).toHaveBeenCalledWith({
        where: {
          id: BigInt(1),
          stock_quantity: {
            gte: 2,
          },
        },
        data: {
          stock_quantity: {
            decrement: 2,
          },
        },
      });

      expect(result.stock_quantity).toBe(8);
    });

    it('should throw when stock is insufficient', async () => {
      prismaMock.products.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.deductStock(BigInt(1), 5),
      ).rejects.toThrow(BadRequestException);

      expect(
        prismaMock.products.findUnique,
      ).not.toHaveBeenCalled();
    });

    it('should reject zero quantity', async () => {
      await expect(
        service.deductStock(BigInt(1), 0),
      ).rejects.toThrow(BadRequestException);

      expect(
        prismaMock.products.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('should reject negative quantity', async () => {
      await expect(
        service.deductStock(BigInt(1), -1),
      ).rejects.toThrow(BadRequestException);

      expect(
        prismaMock.products.updateMany,
      ).not.toHaveBeenCalled();
    });
  });
});