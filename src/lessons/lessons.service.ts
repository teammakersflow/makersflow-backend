import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';

import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(
    private prisma: PrismaService,
    private enrollmentsService: EnrollmentsService,
  ) {}

  // =========================
  // ADMIN
  // =========================

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

  // =========================
  // STUDENT
  // =========================

  async findOneForStudent(
    lessonId: bigint,
    userId: string,
  ) {
    const lesson = await this.prisma.lessons.findUnique({
      where: {
        id: lessonId,
      },
      include: {
        modules: {
          select: {
            id: true,
            course_id: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const courseId = lesson.modules.course_id;

    // Preview lessons can be accessed without enrollment.
    if (lesson.is_preview) {
      return lesson;
    }

    const enrollment =
      await this.enrollmentsService.findMyEnrollment(
        userId,
        courseId,
      );

    if (!enrollment) {
      throw new ForbiddenException(
        'You are not enrolled in this course',
      );
    }

    return lesson;
  }
}