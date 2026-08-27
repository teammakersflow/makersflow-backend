import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { CreateShippingAddressDto } from './dto/create-shipping-address.dto';
import { UpdateShippingAddressDto } from './dto/update-shipping-address.dto';

@Injectable()
export class ShippingAddressesService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.shipping_addresses.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  create(
    userId: string,
    createShippingAddressDto: CreateShippingAddressDto,
  ) {
    return this.prisma.shipping_addresses.create({
      data: {
        ...createShippingAddressDto,
        user_id: userId,
      },
    });
  }

  async update(
    userId: string,
    id: bigint,
    updateShippingAddressDto: UpdateShippingAddressDto,
  ) {
    const address =
      await this.prisma.shipping_addresses.findFirst({
        where: {
          id,
          user_id: userId,
        },
      });

    if (!address) {
      throw new NotFoundException(
        'Shipping address not found',
      );
    }

    return this.prisma.shipping_addresses.update({
      where: {
        id,
      },
      data: updateShippingAddressDto,
    });
  }

  async remove(userId: string, id: bigint) {
    const address =
      await this.prisma.shipping_addresses.findFirst({
        where: {
          id,
          user_id: userId,
        },
      });

    if (!address) {
      throw new NotFoundException(
        'Shipping address not found',
      );
    }

    return this.prisma.shipping_addresses.delete({
      where: {
        id,
      },
    });
  }
}