import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLessonResourceDto } from './dto/create-lesson-resource.dto';
import { UpdateLessonResourceDto } from './dto/update-lesson-resource.dto';

@Injectable()
export class LessonResourcesService {
  constructor(private prisma: PrismaService) {}

  create(createLessonResourceDto: CreateLessonResourceDto) {
    return this.prisma.lesson_resources.create({
      data: {
        ...createLessonResourceDto,
        lesson_id: BigInt(createLessonResourceDto.lesson_id),
        ...(createLessonResourceDto.size_bytes !== undefined
          ? { size_bytes: BigInt(createLessonResourceDto.size_bytes) }
          : {}),
      },
    });
  }

  findAll() {
    return this.prisma.lesson_resources.findMany();
  }

  findOne(id: string) {
    return this.prisma.lesson_resources.findUnique({
      where: { id },
    });
  }

  update(
    id: string,
    updateLessonResourceDto: UpdateLessonResourceDto,
  ) {
    const { lesson_id, size_bytes, ...data } = updateLessonResourceDto;

    return this.prisma.lesson_resources.update({
      where: { id },
      data: {
        ...data,
        ...(lesson_id !== undefined
          ? { lesson_id: BigInt(lesson_id) }
          : {}),
        ...(size_bytes !== undefined
          ? { size_bytes: BigInt(size_bytes) }
          : {}),
      },
    });
  }

  remove(id: string) {
    return this.prisma.lesson_resources.delete({
      where: { id },
    });
  }
}