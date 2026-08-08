import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  create(createLessonDto: CreateLessonDto) {
    return this.prisma.lessons.create({
      data: createLessonDto,
    });
  }

  findAll() {
    return this.prisma.lessons.findMany();
  }

  findOne(id: bigint) {
    return this.prisma.lessons.findUnique({
      where: { id },
    });
  }

  update(id: bigint, updateLessonDto: UpdateLessonDto) {
    return this.prisma.lessons.update({
      where: { id },
      data: updateLessonDto,
    });
  }

  remove(id: bigint) {
    return this.prisma.lessons.delete({
      where: { id },
    });
  }
}