import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import {
  activeEnrollmentWhere,
  isEnrollmentActive,
  type EnrollmentAccessFields,
} from './enrollment-access';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService,
    private readonly storage: StorageService,) {}

  // =========================
  // ADMIN METHODS
  // =========================

  create(createEnrollmentDto: CreateEnrollmentDto) {
    return this.prisma.enrollments.create({
      data: {
        ...createEnrollmentDto,
        course_id: BigInt(createEnrollmentDto.course_id),
      },
    });
  }

  async findAll(
    includeUser = false,
    includeCourse = false,
  ) {
    const include: any = {};

    if (includeUser) {
      include.users = {
        select: {
          id: true,
          email: true,
          full_name: true,
        },
      };
    }

    if (includeCourse) {
      include.courses = {
        select: {
          id: true,
          title: true,
          price: true,
          is_free: true,
        },
      };
    }

    const enrollments: any[] =
      await this.prisma.enrollments.findMany({
        include,
      });

    return enrollments.map((enrollment: any) => {
      const {
        users,
        courses,
        ...enrollmentData
      } = enrollment;

      return {
        ...enrollmentData,

        ...(includeUser && {
          user: users,
        }),

        ...(includeCourse && {
          course: courses,
        }),
      };
    });
  }

  findOne(id: string) {
    return this.prisma.enrollments.findUnique({
      where: { id },
    });
  }

  update(
    id: string,
    updateEnrollmentDto: UpdateEnrollmentDto,
  ) {
    return this.prisma.enrollments.update({
      where: { id },
      data: updateEnrollmentDto,
    });
  }

  remove(id: string) {
    return this.prisma.enrollments.delete({
      where: { id },
    });
  }

  // =========================
  // STUDENT METHODS
  // =========================

  private async signCourse<T extends { courses?: { thumbnail_url: string | null } | null }>(row: T): Promise<T> {
    if (!row.courses?.thumbnail_url) return row;
    const signed = await this.storage.createSignedImageUrl(row.courses.thumbnail_url);
    return { ...row, courses: { ...row.courses, thumbnail_url: signed ?? row.courses.thumbnail_url } };
  }

  async findMyEnrollments(userId: string) {
    return this.prisma.enrollments.findMany({
      where: {
        user_id: userId,
      },
      include: {
        courses: {
          select: {
            id: true,
            title: true,
            description: true,
            thumbnail_url: true,
            price: true,
            is_free: true,
            level: true,
            is_published: true,
          },
        },
      },
      orderBy: {
        enrolled_at: 'desc',
      },
    }).then((rows) => Promise.all(rows.map((r) => this.signCourse(r))));
  }

  /**
   * The user's enrollment in `courseId` ONLY if it currently grants access
   * (B-2: allow-listed payment_status; expiry is not enforced for now, see
   * ENROLLMENT_EXPIRY_ENFORCED in enrollment-access.ts).
   * Returns null otherwise. Every content route gates on this.
   */
  async findMyEnrollment(
  userId: string,
  courseId: bigint,
) {
  const now = new Date();
  return this.prisma.enrollments.findFirst({
    where: activeEnrollmentWhere(userId, courseId, now),
    include: {
      courses: {
        select: {
          id: true,
          title: true,
          description: true,
          thumbnail_url: true,
          price: true,
          is_free: true,
          level: true,
          is_published: true,
        },
      },
    },
  }).then((r) =>
    // Re-check in code so the rule holds even if the query filter changes.
    r && isEnrollmentActive(r, now) ? this.signCourse(r) : null,
  );
}
  async enrollInFreeCourse(
    userId: string,
    courseId: bigint,
  ) {
    const course = await this.prisma.courses.findUnique({
      where: {
        id: courseId,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!course.is_free) {
      throw new BadRequestException(
        'This course is not free',
      );
    }

    const existingEnrollment =
      await this.prisma.enrollments.findUnique({
        where: {
          user_id_course_id: {
            user_id: userId,
            course_id: courseId,
          },
        },
      });

    const courseSelect = {
      id: true,
      title: true,
      description: true,
      thumbnail_url: true,
      price: true,
      is_free: true,
    };

    if (existingEnrollment) {
      if (isEnrollmentActive(existingEnrollment)) {
        throw new ConflictException(
          'Student is already enrolled in this course',
        );
      }

      // B-2: an inactive enrollment in a free course (pending, failed, ...; or
      // expired once expiry is enforced) is renewed with a fresh (no) expiry
      // instead of blocking the student forever.
      return this.prisma.enrollments.update({
        where: {
          user_id_course_id: {
            user_id: userId,
            course_id: courseId,
          },
        },
        data: {
          payment_status: 'completed',
          expires_at: null,
        },
        include: {
          courses: {
            select: courseSelect,
          },
        },
      });
    }

    return this.prisma.enrollments.create({
      data: {
        user_id: userId,
        course_id: courseId,
        payment_status: 'completed',
      },
      include: {
        courses: {
          select: courseSelect,
        },
      },
    });
  }

  async createPaidEnrollment(
    userId: string,
    courseId: bigint,
    razorpayOrderId: string,
    tx: any = this.prisma,
  ) {
    const existingEnrollment = await tx.enrollments.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
    });

    if (existingEnrollment) {
      // B-2: re-purchase or renewal. Anything other than a currently active
      // 'completed' enrollment (pending, refunded, ...; expired too once
      // expiry is enforced) is reactivated with a fresh expiry. NestJS has no
      // course access period, so a fresh expiry is "none" (null), the same as
      // a first purchase.
      if (
        existingEnrollment.payment_status !== 'completed' ||
        !isEnrollmentActive(existingEnrollment as EnrollmentAccessFields)
      ) {
        return tx.enrollments.update({
          where: {
            user_id_course_id: {
              user_id: userId,
              course_id: courseId,
            },
          },
          data: {
            payment_status: 'completed',
            razorpay_order_id: razorpayOrderId,
            expires_at: null,
          },
        });
      }

      return existingEnrollment;
    }

    return tx.enrollments.create({
      data: {
        user_id: userId,
        course_id: courseId,
        payment_status: 'completed',
        razorpay_order_id: razorpayOrderId,
      },
    });
  }

}