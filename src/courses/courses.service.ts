import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  create(createCourseDto: CreateCourseDto) {
    return this.prisma.courses.create({
      data: createCourseDto,
    });
  }

  findAll() {
    return this.prisma.courses.findMany();
  }

  findOne(id: bigint) {
    return this.prisma.courses.findUnique({
      where: { id },
    });
  }

  update(id: bigint, updateCourseDto: UpdateCourseDto) {
    return this.prisma.courses.update({
      where: { id },
      data: updateCourseDto,
    });
  }

  remove(id: bigint) {
    return this.prisma.courses.delete({
      where: { id },
    });
  }
}