import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  create(createProductDto: CreateProductDto) {
    return this.prisma.products.create({
      data: createProductDto,
    });
  }

async findAll(
  page = 1,
  limit = 10,
  search?: string,
) {
  const skip = (page - 1) * limit;

  const where: any = {};

  if (search) {
    where.OR = [
      {
        title: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        description: {
          contains: search,
          mode: 'insensitive',
        },
      },
    ];
  }

  const [products, total] = await Promise.all([
    this.prisma.products.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
    }),

    this.prisma.products.count({
      where,
    }),
  ]);

  return {
    success: true,
    message: 'Products fetched successfully',
    data: products,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

  findOne(id: bigint) {
    return this.prisma.products.findUnique({
      where: { id },
    });
  }

  update(id: bigint, updateProductDto: UpdateProductDto) {
    return this.prisma.products.update({
      where: { id },
      data: updateProductDto,
    });
  }

  remove(id: bigint) {
    return this.prisma.products.delete({
      where: { id },
    });
  }

  async deductStock(
  productId: bigint,
  quantity: number,
  tx: any = this.prisma,
) {
  if (quantity <= 0) {
    throw new BadRequestException(
      'Quantity must be greater than 0',
    );
  }

  const result = await tx.products.updateMany({
    where: {
      id: productId,
      stock_quantity: {
        gte: quantity,
      },
    },
    data: {
      stock_quantity: {
        decrement: quantity,
      },
    },
  });

  if (result.count === 0) {
    throw new BadRequestException(
      'Insufficient inventory',
    );
  }

  return tx.products.findUnique({
    where: {
      id: productId,
    },
  });
}
}