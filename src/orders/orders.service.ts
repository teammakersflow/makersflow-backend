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

async findAll(includeUser = false) {
  if (!includeUser) {
    return this.prisma.orders.findMany();
  }

  const orders = await this.prisma.orders.findMany({
    include: {
      users: {
        select: {
          id: true,
          email: true,
          full_name: true,
        },
      },
    },
  });

  return orders.map(({ users, ...order }) => ({
    ...order,
    user: users,
  }));
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