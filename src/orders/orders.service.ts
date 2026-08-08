import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  create(createOrderDto: CreateOrderDto) {
    return this.prisma.orders.create({
      data: createOrderDto,
    });
  }

  findAll() {
    return this.prisma.orders.findMany();
  }

  findOne(id: string) {
    return this.prisma.orders.findUnique({
      where: { id },
    });
  }

  update(id: string, updateOrderDto: UpdateOrderDto) {
    return this.prisma.orders.update({
      where: { id },
      data: updateOrderDto,
    });
  }

  remove(id: string) {
    return this.prisma.orders.delete({
      where: { id },
    });
  }
}