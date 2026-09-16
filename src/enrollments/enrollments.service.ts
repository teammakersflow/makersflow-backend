import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

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
    });
  }

  async findMyEnrollment(
    userId: string,
    courseId: bigint,
  ) {
    return this.prisma.enrollments.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
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
    });
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

    if (existingEnrollment) {
      throw new ConflictException(
        'Student is already enrolled in this course',
      );
    }

    return this.prisma.enrollments.create({
      data: {
        user_id: userId,
        course_id: courseId,
        payment_status: 'completed',
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
          },
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
  const existingEnrollment =
    await tx.enrollments.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
    });

  if (existingEnrollment) {
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