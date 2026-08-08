import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  create(createPaymentDto: CreatePaymentDto) {
    return this.prisma.payments.create({
      data: createPaymentDto,
    });
  }

  findAll() {
    return this.prisma.payments.findMany();
  }

  findOne(id: string) {
    return this.prisma.payments.findUnique({
      where: { id },
    });
  }

  update(id: string, updatePaymentDto: UpdatePaymentDto) {
    return this.prisma.payments.update({
      where: { id },
      data: updatePaymentDto,
    });
  }

  remove(id: string) {
    return this.prisma.payments.delete({
      where: { id },
    });
  }
}