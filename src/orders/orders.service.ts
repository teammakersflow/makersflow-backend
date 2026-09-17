import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateOrderDto } from './dto/create-order.dto';

import { UpdateOrderDto } from './dto/update-order.dto';

import { BulkUpdateOrdersDto } from './dto/bulk-update-orders.dto';

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
async findMyOrders(userId: string) {
  return this.prisma.orders.findMany({
    where: {
      user_id: userId,
    },
    orderBy: {
      created_at: 'desc',
    },
  });
}

async findMyOrder(userId: string, orderId: string) {
  return this.prisma.orders.findFirst({
    where: {
      id: orderId,
      user_id: userId,
    },
  });
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

  async bulkUpdate(bulkUpdateOrdersDto: BulkUpdateOrdersDto) {
  const { ids, data } = bulkUpdateOrdersDto;

  const succeeded: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const id of ids) {
    try {
      await this.prisma.orders.update({
        where: { id },
        data,
      });

      succeeded.push(id);
    } catch (error) {
      failed.push({
        id,
        reason:
          error instanceof Error
            ? error.message
            : 'Failed to update order',
      });
    }
  }

  return {
    succeeded,
    failed,
  };
}

  remove(id: string) {
    return this.prisma.orders.delete({
      where: { id },
    });
  }
}