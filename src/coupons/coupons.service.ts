import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Injectable()
export class CouponsService {
  async validate(
  userId: string,
  dto: ValidateCouponDto,
) {
  const coupon = await this.prisma.coupons.findUnique({
    where: {
      code: dto.code,
    },
  });

  if (!coupon) {
    throw new BadRequestException('Invalid coupon code');
  }

  if (coupon.is_active === false) {
    throw new BadRequestException('Coupon is inactive');
  }

  if (
    coupon.expiry_date &&
    coupon.expiry_date < new Date()
  ) {
    throw new BadRequestException('Coupon has expired');
  }

  if (
    coupon.usage_limit !== null &&
    coupon.usage_count !== null &&
    coupon.usage_count >= coupon.usage_limit
  ) {
    throw new BadRequestException(
      'Coupon usage limit reached',
    );
  }

  const alreadyUsed =
    await this.prisma.coupon_usage.findUnique({
      where: {
        coupon_id_user_id: {
          coupon_id: coupon.id,
          user_id: userId,
        },
      },
    });

  if (alreadyUsed) {
    throw new BadRequestException(
      'You have already used this coupon',
    );
  }

  const minimumOrder =
    coupon.minimum_order_amount ?? 0;

  if (dto.order_amount < Number(minimumOrder)) {
    throw new BadRequestException(
      `Minimum order amount is ${minimumOrder}`,
    );
  }

  // Check applicability
  if (coupon.applicable_to === 'course') {
    const courseIds =
      dto.course_ids ?? [];

    const applicable =
      courseIds.some((id) =>
        coupon.applicable_course_ids.includes(id),
      );

    if (!applicable) {
      throw new BadRequestException(
        'Coupon is not applicable to these courses',
      );
    }
  }

  if (coupon.applicable_to === 'product') {
    const productIds =
      dto.product_ids ?? [];

    const applicable =
      productIds.some((id) =>
        coupon.applicable_product_ids.includes(id),
      );

    if (!applicable) {
      throw new BadRequestException(
        'Coupon is not applicable to these products',
      );
    }
  }

  // Calculate discount on the backend
  let discount: number;

  if (coupon.discount_type === 'percentage') {
    discount =
      (dto.order_amount *
        Number(coupon.discount_value)) /
      100;
  } else if (coupon.discount_type === 'fixed') {
    discount = Number(coupon.discount_value);
  } else {
    throw new BadRequestException(
      'Invalid discount type',
    );
  }

  const maximumDiscount =
    coupon.maximum_discount !== null
      ? Number(coupon.maximum_discount)
      : null;

  if (
    maximumDiscount !== null &&
    discount > maximumDiscount
  ) {
    discount = maximumDiscount;
  }

  discount = Math.min(
    discount,
    dto.order_amount,
  );

  return {
    valid: true,
    coupon_id: coupon.id,
    code: coupon.code,
    discount_amount: discount,
    final_amount:
      dto.order_amount - discount,
  };
}
  constructor(private prisma: PrismaService) {}

  create(createCouponDto: CreateCouponDto) {
    return this.prisma.coupons.create({
      data: createCouponDto,
    });
  }

  findAll() {
    return this.prisma.coupons.findMany();
  }

  findOne(id: string) {
    return this.prisma.coupons.findUnique({
      where: { id },
    });
  }

  update(id: string, updateCouponDto: UpdateCouponDto) {
    return this.prisma.coupons.update({
      where: { id },
      data: updateCouponDto,
    });
  }

  remove(id: string) {
    return this.prisma.coupons.delete({
      where: { id },
    });
  }
}