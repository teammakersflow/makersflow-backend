import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';

@Injectable()
export class PromoCodesService {
  constructor(private prisma: PrismaService) {}

  create(createPromoCodeDto: CreatePromoCodeDto) {
    return this.prisma.promo_codes.create({
      data: createPromoCodeDto,
    });
  }

  findAll() {
    return this.prisma.promo_codes.findMany();
  }

  findOne(id: string) {
    return this.prisma.promo_codes.findUnique({
      where: { id },
    });
  }

  update(id: string, updatePromoCodeDto: UpdatePromoCodeDto) {
    return this.prisma.promo_codes.update({
      where: { id },
      data: updatePromoCodeDto,
    });
  }

  remove(id: string) {
    return this.prisma.promo_codes.delete({
      where: { id },
    });
  }
}