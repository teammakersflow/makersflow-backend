import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyWishlist(userId: string) {
    return this.prisma.wishlist.findMany({
      where: {
        user_id: userId,
      },
      include: {
        products: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async addToWishlist(
    userId: string,
    productId: bigint,
  ) {
    const product = await this.prisma.products.findUnique({
      where: {
        id: productId,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.prisma.wishlist.findUnique({
      where: {
        user_id_product_id: {
          user_id: userId,
          product_id: productId,
        },
      },
      include: {
        products: true,
      },
    });

    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.wishlist.create({
        data: {
          user_id: userId,
          product_id: productId,
        },
        include: {
          products: true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Product is already in wishlist',
        );
      }

      throw error;
    }
  }

    async removeFromWishlist(
    userId: string,
    productId: bigint,
  ) {
    const wishlistItem = await this.prisma.wishlist.findUnique({
      where: {
        user_id_product_id: {
          user_id: userId,
          product_id: productId,
        },
      },
    });

    if (!wishlistItem) {
      throw new NotFoundException(
        'Product is not in wishlist',
      );
    }

    return this.prisma.wishlist.delete({
      where: {
        user_id_product_id: {
          user_id: userId,
          product_id: productId,
        },
      },
    });
  }
}