import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(createCategoryDto: CreateCategoryDto) {
    return this.prisma.categories.create({
      data: createCategoryDto,
    });
  }

  findAll() {
    return this.prisma.categories.findMany();
  }

  findOne(id: bigint) {
    return this.prisma.categories.findUnique({
      where: { id },
    });
  }

  update(id: bigint, updateCategoryDto: UpdateCategoryDto) {
    return this.prisma.categories.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  remove(id: bigint) {
    return this.prisma.categories.delete({
      where: { id },
    });
  }
}