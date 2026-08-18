import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateLessonProgressDto } from './dto/create-lesson-progress.dto';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';

@Injectable()
export class LessonProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createLessonProgressDto: CreateLessonProgressDto) {
    return this.prisma.lesson_progress.create({
      data: {
        user_id: createLessonProgressDto.user_id,
        course_id: BigInt(createLessonProgressDto.course_id),
        lesson_id: BigInt(createLessonProgressDto.lesson_id),
        is_completed: createLessonProgressDto.is_completed ?? false,
        current_time_secs:
          createLessonProgressDto.current_time_secs ?? 0,
        watch_percentage:
          createLessonProgressDto.watch_percentage ?? 0,
        time_spent_secs:
          createLessonProgressDto.time_spent_secs ?? 0,
        last_watched_at:
          createLessonProgressDto.last_watched_at
            ? new Date(createLessonProgressDto.last_watched_at)
            : undefined,
      },
    });
  }

  async findAll() {
    return this.prisma.lesson_progress.findMany({
      orderBy: {
        last_watched_at: 'desc',
      },
    });
  }

  async findOne(id: bigint) {
    const lessonProgress = await this.prisma.lesson_progress.findUnique({
      where: {
        id,
      },
    });

    if (!lessonProgress) {
      throw new NotFoundException('Lesson progress not found');
    }

    return lessonProgress;
  }

  async update(
    id: bigint,
    updateLessonProgressDto: UpdateLessonProgressDto,
  ) {
    await this.findOne(id);

    const data: any = {};

    if (updateLessonProgressDto.user_id !== undefined) {
      data.user_id = updateLessonProgressDto.user_id;
    }

    if (updateLessonProgressDto.course_id !== undefined) {
      data.course_id = BigInt(updateLessonProgressDto.course_id);
    }

    if (updateLessonProgressDto.lesson_id !== undefined) {
      data.lesson_id = BigInt(updateLessonProgressDto.lesson_id);
    }

    if (updateLessonProgressDto.is_completed !== undefined) {
      data.is_completed = updateLessonProgressDto.is_completed;
    }

    if (updateLessonProgressDto.current_time_secs !== undefined) {
      data.current_time_secs =
        updateLessonProgressDto.current_time_secs;
    }

    if (updateLessonProgressDto.watch_percentage !== undefined) {
      data.watch_percentage =
        updateLessonProgressDto.watch_percentage;
    }

    if (updateLessonProgressDto.time_spent_secs !== undefined) {
      data.time_spent_secs =
        updateLessonProgressDto.time_spent_secs;
    }

    if (updateLessonProgressDto.last_watched_at !== undefined) {
      data.last_watched_at = new Date(
        updateLessonProgressDto.last_watched_at,
      );
    }

    return this.prisma.lesson_progress.update({
      where: {
        id,
      },
      data,
    });
  }

  async remove(id: bigint) {
    await this.findOne(id);

    return this.prisma.lesson_progress.delete({
      where: {
        id,
      },
    });
  }
}