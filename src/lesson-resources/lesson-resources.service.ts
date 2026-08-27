import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';

import { CreateLessonResourceDto } from './dto/create-lesson-resource.dto';
import { UpdateLessonResourceDto } from './dto/update-lesson-resource.dto';

@Injectable()
export class LessonResourcesService {
  constructor(
    private prisma: PrismaService,
    private enrollmentsService: EnrollmentsService,
  ) {}

  // =========================
  // ADMIN METHODS
  // =========================

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
    const { lesson_id, size_bytes, ...data } =
      updateLessonResourceDto;

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

  // =========================
  // STUDENT METHODS
  // =========================

  async findOneForStudent(
    id: string,
    userId: string,
  ) {
    const resource =
      await this.prisma.lesson_resources.findUnique({
        where: { id },
      });

    if (!resource) {
      throw new NotFoundException(
        'Lesson resource not found',
      );
    }

    const lesson = await this.prisma.lessons.findUnique({
      where: {
        id: resource.lesson_id,
      },
      include: {
        modules: {
          select: {
            course_id: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(
        'Lesson associated with resource not found',
      );
    }

    // Allow preview lessons.
    if (lesson.is_preview) {
      return resource;
    }

    const enrollment =
      await this.enrollmentsService.findMyEnrollment(
        userId,
        lesson.modules.course_id,
      );

    if (!enrollment) {
      throw new ForbiddenException(
        'You are not enrolled in this course',
      );
    }

    return resource;
  }

  async findByLessonForStudent(
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
            course_id: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (!lesson.is_preview) {
      const enrollment =
        await this.enrollmentsService.findMyEnrollment(
          userId,
          lesson.modules.course_id,
        );

      if (!enrollment) {
        throw new ForbiddenException(
          'You are not enrolled in this course',
        );
      }
    }

    return this.prisma.lesson_resources.findMany({
      where: {
        lesson_id: lessonId,
      },
      orderBy: {
        created_at: 'asc',
      },
    });
  }
}