import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCoursePurchaseDto } from './dto/create-course-purchase.dto';
import { UpdateCoursePurchaseDto } from './dto/update-course-purchase.dto';

@Injectable()
export class CoursePurchasesService {
  constructor(private prisma: PrismaService) {}

  create(createCoursePurchaseDto: CreateCoursePurchaseDto) {
    return this.prisma.course_purchases.create({
      data: {
        ...createCoursePurchaseDto,
        course_id: BigInt(createCoursePurchaseDto.course_id),
      },
    });
  }

  findAll() {
    return this.prisma.course_purchases.findMany();
  }

  findOne(id: string) {
    return this.prisma.course_purchases.findUnique({
      where: { id },
    });
  }

  update(
    id: string,
    updateCoursePurchaseDto: UpdateCoursePurchaseDto,
  ) {
    const { course_id, ...data } = updateCoursePurchaseDto;

    return this.prisma.course_purchases.update({
      where: { id },
      data: {
        ...data,
        ...(course_id !== undefined
          ? { course_id: BigInt(course_id) }
          : {}),
      },
    });
  }

  remove(id: string) {
    return this.prisma.course_purchases.delete({
      where: { id },
    });
  }
}