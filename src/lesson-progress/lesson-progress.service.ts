import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { StreaksService } from '../streaks/streaks.service';

import { CreateLessonProgressDto } from './dto/create-lesson-progress.dto';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';

@Injectable()
export class LessonProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streaksService: StreaksService,
  ) {}

  // =========================
  // SECURITY HELPERS
  // =========================

  private async verifyEnrollment(
    userId: string,
    courseId: bigint,
  ) {
    const enrollment =
      await this.prisma.enrollments.findUnique({
        where: {
          user_id_course_id: {
            user_id: userId,
            course_id: courseId,
          },
        },
      });

    if (!enrollment) {
      throw new ForbiddenException(
        'You are not enrolled in this course',
      );
    }

    return enrollment;
  }

  private async verifyLessonBelongsToCourse(
    lessonId: bigint,
    courseId: bigint,
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
      throw new NotFoundException(
        'Lesson not found',
      );
    }

    if (lesson.modules.course_id !== courseId) {
      throw new BadRequestException(
        'Lesson does not belong to this course',
      );
    }

    return lesson;
  }

  // =========================
  // GET MY PROGRESS
  // =========================

  async findMyProgress(userId: string) {
    return this.prisma.lesson_progress.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        last_watched_at: 'desc',
      },
    });
  }

  // =========================
  // GET COURSE PROGRESS
  // =========================

  async findMyCourseProgress(
    userId: string,
    courseId: bigint,
  ) {
    await this.verifyEnrollment(
      userId,
      courseId,
    );

    const lessons =
      await this.prisma.lessons.findMany({
        where: {
          modules: {
            course_id: courseId,
          },
        },
        select: {
          id: true,
          module_id: true,
          title: true,
          order_index: true,
        },
        orderBy: [
          {
            module_id: 'asc',
          },
          {
            order_index: 'asc',
          },
        ],
      });

    const progress =
      await this.prisma.lesson_progress.findMany({
        where: {
          user_id: userId,
          course_id: courseId,
        },
      });

    const progressMap = new Map(
      progress.map((item) => [
        item.lesson_id.toString(),
        item,
      ]),
    );

    const completedLessons =
      progress.filter(
        (item) => item.is_completed,
      ).length;

    const totalLessons = lessons.length;

    const completionPercentage =
      totalLessons === 0
        ? 0
        : Math.round(
            (completedLessons / totalLessons) * 100,
          );

    return {
      course_id: courseId.toString(),
      total_lessons: totalLessons,
      completed_lessons: completedLessons,
      completion_percentage: completionPercentage,
      is_completed:
        totalLessons > 0 &&
        completedLessons === totalLessons,
      lessons: lessons.map((lesson) => ({
        lesson_id: lesson.id.toString(),
        module_id: lesson.module_id.toString(),
        title: lesson.title,
        order_index: lesson.order_index,
        progress:
          progressMap.get(
            lesson.id.toString(),
          ) ?? null,
      })),
    };
  }

  // =========================
  // CREATE PROGRESS
  // =========================

async create(
  userId: string,
  dto: CreateLessonProgressDto,
) {
  const courseId = BigInt(dto.course_id);
  const lessonId = BigInt(dto.lesson_id);

  await this.verifyEnrollment(
    userId,
    courseId,
  );

  await this.verifyLessonBelongsToCourse(
    lessonId,
    courseId,
  );

  const existing =
    await this.prisma.lesson_progress.findUnique({
      where: {
        user_id_course_id_lesson_id: {
          user_id: userId,
          course_id: courseId,
          lesson_id: lessonId,
        },
      },
    });

  if (existing) {
    throw new ConflictException(
      'Lesson progress already exists',
    );
  }

  const progress =
    await this.prisma.lesson_progress.create({
      data: {
        user_id: userId,
        course_id: courseId,
        lesson_id: lessonId,
        is_completed:
          dto.is_completed ?? false,
        current_time_secs:
          dto.current_time_secs ?? 0,
        watch_percentage:
          dto.watch_percentage ?? 0,
        time_spent_secs:
          dto.time_spent_secs ?? 0,
        last_watched_at:
          dto.last_watched_at
            ? new Date(dto.last_watched_at)
            : undefined,
      },
    });

  // Record learning activity only when the lesson
  // is completed.
  if (dto.is_completed === true) {
    await this.streaksService.recordActivity(userId);
  }

  return progress;
}

  // =========================
  // UPDATE PROGRESS
  // =========================

  async update(
    userId: string,
    id: bigint,
    dto: UpdateLessonProgressDto,
  ) {
    const existing =
      await this.prisma.lesson_progress.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Lesson progress not found',
      );
    }

    if (existing.user_id !== userId) {
      throw new ForbiddenException(
        'You cannot modify another student\'s progress',
      );
    }

    if (
      dto.course_id !== undefined &&
      BigInt(dto.course_id) !== existing.course_id
    ) {
      throw new BadRequestException(
        'Course cannot be changed',
      );
    }

    if (
      dto.lesson_id !== undefined &&
      BigInt(dto.lesson_id) !== existing.lesson_id
    ) {
      throw new BadRequestException(
        'Lesson cannot be changed',
      );
    }

    const courseId =
      dto.course_id !== undefined
        ? BigInt(dto.course_id)
        : existing.course_id;

    const lessonId =
      dto.lesson_id !== undefined
        ? BigInt(dto.lesson_id)
        : existing.lesson_id;

    await this.verifyEnrollment(
      userId,
      courseId,
    );

    await this.verifyLessonBelongsToCourse(
      lessonId,
      courseId,
    );

    const data: any = {};

    if (dto.is_completed !== undefined) {
      data.is_completed = dto.is_completed;
    }

    if (
      dto.current_time_secs !== undefined
    ) {
      data.current_time_secs =
        dto.current_time_secs;
    }

    if (
      dto.watch_percentage !== undefined
    ) {
      data.watch_percentage =
        dto.watch_percentage;
    }

    if (
      dto.time_spent_secs !== undefined
    ) {
      data.time_spent_secs =
        dto.time_spent_secs;
    }

    if (
      dto.last_watched_at !== undefined
    ) {
      data.last_watched_at =
        new Date(dto.last_watched_at);
    }

    // Remember whether the lesson was already completed.
    const wasCompleted = existing.is_completed;

    const progress =
      await this.prisma.lesson_progress.update({
        where: {
          id,
        },
        data,
      });

    // Record activity only when the lesson changes
    // from incomplete → completed.
    if (!wasCompleted && progress.is_completed) {
      await this.streaksService.recordActivity(userId);
    }

    return progress;
  }

  // =========================
  // DELETE PROGRESS
  // =========================

  async remove(
    userId: string,
    id: bigint,
  ) {
    const existing =
      await this.prisma.lesson_progress.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Lesson progress not found',
      );
    }

    if (existing.user_id !== userId) {
      throw new ForbiddenException(
        'You cannot delete another student\'s progress',
      );
    }

    return this.prisma.lesson_progress.delete({
      where: {
        id,
      },
    });
  }
}