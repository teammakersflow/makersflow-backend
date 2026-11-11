import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { StorageService } from '../storage/storage.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

/**
 * B-1 (2026-11-11): replaces the raw storage path in every non-admin response.
 * The apps only use video_url as a "this lesson has a video" flag and always
 * play through GET /lessons/:id/video (signed, enrollment-checked), so a
 * non-empty marker keeps installed app versions working without leaking the path.
 * Same value as PROTECTED_VIDEO_MARKER in the mobile app.
 */
export const PROTECTED_VIDEO_MARKER = '__protected__';

/** Caller identity as set by JwtAuthGuard / OptionalJwtAuthGuard (null = anonymous). */
export type LessonCaller = { id: string; role?: string } | null | undefined;

export function isAdminCaller(caller: LessonCaller): boolean {
  return !!caller && caller.role === 'admin';
}

@Injectable()
export class LessonsService {
  constructor(
    private prisma: PrismaService,
    private enrollmentsService: EnrollmentsService,
    private storageService: StorageService,
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
    // B-1: never let the redaction marker be saved over a real video path.
    if (
      (updateLessonDto as { video_url?: unknown })?.video_url ===
      PROTECTED_VIDEO_MARKER
    ) {
      throw new BadRequestException('video_url must be a real storage path');
    }

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
  // PUBLIC / CALLER-AWARE LIST (B-1)
  // =========================

  /**
   * GET /lessons.
   *
   * - admin: full rows (unchanged admin behaviour).
   * - everyone else: curriculum metadata only (id, module_id, title, order,
   *   duration, is_preview, has_video). video_url is never the real path.
   * - content and notes are included only for a signed-in caller AND only for
   *   preview lessons or lessons of a course the caller is enrolled in
   *   (EnrollmentsService.findMyEnrollment, the same check as GET /lessons/:id).
   *   Anonymous callers never receive content or notes.
   */
  async findAllForCaller(caller: LessonCaller) {
    if (isAdminCaller(caller)) {
      return this.findAll();
    }

    const userId = caller?.id;
    const signedIn = !!userId;

    const rows = await this.prisma.lessons.findMany({
      select: {
        id: true,
        module_id: true,
        title: true,
        order_index: true,
        order: true,
        duration_secs: true,
        is_preview: true,
        created_at: true,
        video_url: true,
        content: signedIn,
        notes: signedIn,
        modules: {
          select: {
            course_id: true,
          },
        },
      },
    });

    const entitledCourses = new Set<string>();

    if (userId) {
      const lockedCourseIds = new Map<string, bigint>();
      for (const row of rows) {
        const courseId = row.modules?.course_id;
        if (!row.is_preview && courseId !== undefined && courseId !== null) {
          lockedCourseIds.set(String(courseId), courseId);
        }
      }

      for (const [key, courseId] of lockedCourseIds) {
        const enrollment = await this.enrollmentsService.findMyEnrollment(
          userId,
          courseId,
        );
        if (enrollment) {
          entitledCourses.add(key);
        }
      }
    }

    return rows.map((row) => {
      const courseKey =
        row.modules?.course_id !== undefined && row.modules?.course_id !== null
          ? String(row.modules.course_id)
          : null;

      const canReadContent =
        signedIn &&
        (row.is_preview === true ||
          (courseKey !== null && entitledCourses.has(courseKey)));

      const withText = row as typeof row & {
        content?: string | null;
        notes?: string[];
      };

      return {
        id: row.id,
        module_id: row.module_id,
        title: row.title,
        order_index: row.order_index,
        order: row.order,
        duration_secs: row.duration_secs,
        is_preview: row.is_preview,
        created_at: row.created_at,
        has_video: !!row.video_url,
        video_url: row.video_url ? PROTECTED_VIDEO_MARKER : null,
        content: canReadContent ? (withText.content ?? null) : null,
        notes: canReadContent ? (withText.notes ?? []) : [],
      };
    });
  }

  // =========================
  // STUDENT
  // =========================

  /**
   * GET /lessons/:id. Admin: full row. Others: preview lesson or enrolled
   * course required (unchanged), and the raw video path is replaced by the
   * marker (B-1); playback uses GET /lessons/:id/video.
   */
  async findOneForCaller(
    lessonId: bigint,
    caller: { id: string; role?: string },
  ) {
    if (isAdminCaller(caller)) {
      const lesson = await this.findOne(lessonId);
      if (!lesson) {
        throw new NotFoundException('Lesson not found');
      }
      return lesson;
    }

    const lesson = await this.findOneForStudent(lessonId, caller.id);
    return {
      ...lesson,
      has_video: !!lesson.video_url,
      video_url: lesson.video_url ? PROTECTED_VIDEO_MARKER : null,
    };
  }

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

  async getVideoUrlForStudent(
    lessonId: bigint,
    userId: string,
  ) {
    const lesson = await this.prisma.lessons.findUnique({
      where: {
        id: lessonId,
      },
      select: {
        id: true,
        is_preview: true,
        video_url: true,
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

    if (!lesson.modules?.course_id) {
      throw new NotFoundException(
        'Course not found for this lesson',
      );
    }

    // Preview lessons are available without enrollment.
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

    if (!lesson.video_url) {
      throw new NotFoundException(
        'Video not available for this lesson',
      );
    }

    return this.storageService.createSignedPlaybackUrl(
      lesson.video_url,
    );
  }
}