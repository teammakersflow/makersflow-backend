import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  create(createProductDto: CreateProductDto) {
    return this.prisma.products.create({
      data: createProductDto,
    });
  }

  findAll() {
    return this.prisma.products.findMany();
  }

  findOne(id: bigint) {
    return this.prisma.products.findUnique({
      where: { id },
    });
  }

  update(id: bigint, updateProductDto: UpdateProductDto) {
    return this.prisma.products.update({
      where: { id },
      data: updateProductDto,
    });
  }

  remove(id: bigint) {
    return this.prisma.products.delete({
      where: { id },
    });
  }
}