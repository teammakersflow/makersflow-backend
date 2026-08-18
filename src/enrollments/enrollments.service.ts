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

  async findAll(includeUser = false, includeCourse = false) {
    if (!includeUser && !includeCourse) {
      return this.prisma.enrollments.findMany();
    }

    const enrollments = await this.prisma.enrollments.findMany({
      include: {
        users: includeUser
          ? {
              select: {
                id: true,
                email: true,
                raw_user_meta_data: true,
              },
            }
          : false,

        courses: includeCourse
          ? {
              select: {
                id: true,
                title: true,
                price: true,
                is_free: true,
              },
            }
          : false,
      },
    });

    return enrollments.map((enrollment) => {
      const { users, courses, ...enrollmentData } = enrollment;

      const result: any = {
        ...enrollmentData,
      };

      if (includeUser && users) {
        const metadata = users.raw_user_meta_data;

        let fullName: string | null = null;

        if (
          metadata &&
          typeof metadata === 'object' &&
          !Array.isArray(metadata) &&
          'full_name' in metadata
        ) {
          const value = (metadata as Record<string, unknown>).full_name;

          if (typeof value === 'string') {
            fullName = value;
          }
        }

        result.user = {
          id: users.id,
          email: users.email,
          full_name: fullName,
        };
      }

      if (includeCourse && courses) {
        result.course = courses;
      }

      return result;
    });
  }

  findOne(id: string) {
    return this.prisma.enrollments.findUnique({
      where: { id },
    });
  }

  update(id: string, updateEnrollmentDto: UpdateEnrollmentDto) {
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