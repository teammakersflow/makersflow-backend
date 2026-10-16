import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';


@Injectable()
export class ProductsService {
  
constructor(
  private prisma: PrismaService,
  private storageService: StorageService,
) {}


  create(createProductDto: CreateProductDto) {
    return this.prisma.products.create({
      data: createProductDto,
    });
  }


private async withSignedImageUrls<T extends {
  thumbnail_url?: string | null;
  images?: unknown;
}>(product: T): Promise<T> {
  const signUrl = (url: string) =>
    this.storageService.createSignedImageUrl(url);

  const thumbnail = product.thumbnail_url
    ? await signUrl(product.thumbnail_url)
    : product.thumbnail_url;

  let images = product.images;

  if (Array.isArray(images)) {
    images = await Promise.all(
      images.map(async (url) =>
        typeof url === 'string' ? signUrl(url) : url,
      ),
    );
  }

  return {
    ...product,
    thumbnail_url: thumbnail,
    images,
  };
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


const signedProducts = await Promise.all(
  products.map((product) => this.withSignedImageUrls(product)),
);

return {
  success: true,
  message: 'Products fetched successfully',
  data: signedProducts,
  pagination: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  },
};
}


async findOne(id: bigint) {
  const product = await this.prisma.products.findUnique({
    where: { id },
  });

  if (!product) return null;

  return this.withSignedImageUrls(product);
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