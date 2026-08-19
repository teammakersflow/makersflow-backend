import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponUsageDto } from './dto/create-coupon-usage.dto';
import { UpdateCouponUsageDto } from './dto/update-coupon-usage.dto';

@Injectable()
export class CouponUsageService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  findAll() {
    return this.prisma.coupon_usage.findMany({
      orderBy: {
        used_at: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const usage = await this.prisma.coupon_usage.findUnique({
      where: {
        id,
      },
    });

    if (!usage) {
      throw new NotFoundException('Coupon usage not found');
    }

    return usage;
  }

  create(createCouponUsageDto: CreateCouponUsageDto) {
    return this.prisma.coupon_usage.create({
      data: {
        coupon_id: createCouponUsageDto.coupon_id,
        user_id: createCouponUsageDto.user_id,
        order_id: createCouponUsageDto.order_id,
        used_at: createCouponUsageDto.used_at
          ? new Date(createCouponUsageDto.used_at)
          : undefined,
      },
    });
  }

  async update(
    id: string,
    updateCouponUsageDto: UpdateCouponUsageDto,
  ) {
    await this.findOne(id);

    return this.prisma.coupon_usage.update({
      where: {
        id,
      },
      data: {
        ...(updateCouponUsageDto.coupon_id !== undefined && {
          coupon_id: updateCouponUsageDto.coupon_id,
        }),
        ...(updateCouponUsageDto.user_id !== undefined && {
          user_id: updateCouponUsageDto.user_id,
        }),
        ...(updateCouponUsageDto.order_id !== undefined && {
          order_id: updateCouponUsageDto.order_id,
        }),
        ...(updateCouponUsageDto.used_at !== undefined && {
          used_at: updateCouponUsageDto.used_at
            ? new Date(updateCouponUsageDto.used_at)
            : null,
        }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.coupon_usage.delete({
      where: {
        id,
      },
    });
  }
}
