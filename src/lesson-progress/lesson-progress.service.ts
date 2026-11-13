import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { StreaksService } from '../streaks/streaks.service';
import {
  activeEnrollmentWhere,
  isEnrollmentActive,
} from '../enrollments/enrollment-access';

import { computeCourseCompletion } from './course-completion';
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

  // B-2 (2026-11-11): was "any enrollment row exists", so pending, failed and
  // refunded enrollments could record progress. Now uses the shared
  // entitlement rule (enrollments/enrollment-access.ts; expiry not enforced
  // for now).
  private async verifyEnrollment(
    userId: string,
    courseId: bigint,
  ) {
    const now = new Date();
    const enrollment =
      await this.prisma.enrollments.findFirst({
        where: activeEnrollmentWhere(userId, courseId, now),
      });

    if (!enrollment || !isEnrollmentActive(enrollment, now)) {
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

    // Only lessons that currently belong to the course count; rows left
    // behind by deleted or moved lessons are ignored (course-completion.ts).
    const completion = computeCourseCompletion(
      lessons,
      progress,
    );

    return {
      course_id: courseId.toString(),
      total_lessons: completion.total_lessons,
      completed_lessons: completion.completed_lessons,
      completion_percentage: completion.completion_percentage,
      is_completed: completion.is_completed,

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

    // ==========================================
    // TRANSACTION
    // ==========================================

    return this.prisma.$transaction(async (tx) => {
      // Create lesson progress
      const progress =
        await tx.lesson_progress.create({
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

      // If the lesson was completed,
      // update streak inside the SAME transaction.
      if (dto.is_completed === true) {
        await this.streaksService.recordActivity(
          userId,
          tx,
        );

        // A new row completed a lesson that was not completed before: if the
        // course is now complete, record the first-completion date.
        await this.stampFirstCompletion(tx, userId, courseId);
      }

      return progress;
    });
  }

  // =========================
  // FIRST-COMPLETION DATE
  // =========================

  /**
   * Records enrollments.completed_at the FIRST time the learner completes the
   * course. Called only when this write turned a not-completed lesson into a
   * completed one (so the course was not complete before it).
   *
   * - Uses the same rule as GET /lesson-progress/my/course/:courseId and the
   *   certificate check (course-completion.ts).
   * - Never overwrites: the update is conditional on completed_at IS NULL, so
   *   rewatches, later progress and re-completing newly added lessons keep the
   *   original date.
   * - completed_at is only a date. Current completion status is always
   *   computed live from the current lessons.
   * - If a certificate already exists (course completed before this column was
   *   stamped), its issued_at is the first-completion date; otherwise now.
   */
  private async stampFirstCompletion(
    tx: any,
    userId: string,
    courseId: bigint,
  ) {
    const [lessons, progress] = await Promise.all([
      tx.lessons.findMany({
        where: { modules: { course_id: courseId } },
        select: { id: true },
      }),
      tx.lesson_progress.findMany({
        where: { user_id: userId, course_id: courseId },
        select: { lesson_id: true, is_completed: true },
      }),
    ]);

    if (!computeCourseCompletion(lessons, progress).is_completed) {
      return;
    }

    const certificate = await tx.certificates.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
      select: { issued_at: true },
    });

    await tx.enrollments.updateMany({
      where: {
        user_id: userId,
        course_id: courseId,
        completed_at: null,
      },
      data: {
        completed_at: certificate?.issued_at ?? new Date(),
      },
    });
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

    // ==========================================
    // DETERMINE IF THIS IS A NEW COMPLETION
    // ==========================================

    const newlyCompleted =
      existing.is_completed === false &&
      dto.is_completed === true;

    // ==========================================
    // TRANSACTION
    // ==========================================

    return this.prisma.$transaction(async (tx) => {
      // Update lesson progress
      const updated =
        await tx.lesson_progress.update({
          where: {
            id,
          },
          data,
        });

      // Update streak ONLY when the lesson
      // changes from incomplete -> completed.
      if (newlyCompleted) {
        await this.streaksService.recordActivity(
          userId,
          tx,
        );

        // Only a real incomplete -> completed change can complete the course
        // for the first time; rewatches and repeated completions never do.
        await this.stampFirstCompletion(tx, userId, existing.course_id);
      }

      return updated;
    });
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