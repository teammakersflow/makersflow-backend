import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@Injectable()
export class PromotionsService {
  constructor(private prisma: PrismaService) {}

  create(createPromotionDto: CreatePromotionDto) {
    return this.prisma.promotions.create({
      data: {
        ...createPromotionDto,
        expires_at: createPromotionDto.expires_at
          ? new Date(createPromotionDto.expires_at)
          : undefined,
      },
    });
  }

  findAll() {
    return this.prisma.promotions.findMany({
      orderBy: {
        display_order: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const promotion = await this.prisma.promotions.findUnique({
      where: {
        id: BigInt(id),
      },
    });

    if (!promotion) {
      throw new NotFoundException(
        `Promotion '${id}' not found`,
      );
    }

    return promotion;
  }

  async update(
    id: string,
    updatePromotionDto: UpdatePromotionDto,
  ) {
    await this.findOne(id);

    return this.prisma.promotions.update({
      where: {
        id: BigInt(id),
      },
      data: {
        ...updatePromotionDto,
        expires_at: updatePromotionDto.expires_at
          ? new Date(updatePromotionDto.expires_at)
          : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.promotions.delete({
      where: {
        id: BigInt(id),
      },
    });
  }
}