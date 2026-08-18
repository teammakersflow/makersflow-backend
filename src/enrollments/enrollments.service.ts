import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  create(createEnrollmentDto: CreateEnrollmentDto) {
    return this.prisma.enrollments.create({
      data: createEnrollmentDto,
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
}