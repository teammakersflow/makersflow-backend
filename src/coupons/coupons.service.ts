import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsService {
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