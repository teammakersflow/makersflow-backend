import {
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

import { CreateCertificateDto } from './dto/create-certificate.dto';
import { CreateStudentCertificateDto } from './dto/create-student-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // =========================
  // ADMIN
  // =========================

  create(
    createCertificateDto: CreateCertificateDto,
  ) {
    return this.prisma.certificates.create({
      data: createCertificateDto,
    });
  }

  findAll() {
    return this.prisma.certificates.findMany();
  }

  findOne(id: string) {
    return this.prisma.certificates.findUnique({
      where: { id },
    });
  }

  update(
    id: string,
    updateCertificateDto: UpdateCertificateDto,
  ) {
    return this.prisma.certificates.update({
      where: { id },
      data: updateCertificateDto,
    });
  }

  remove(id: string) {
    return this.prisma.certificates.delete({
      where: { id },
    });
  }

  // =========================
  // STUDENT
  // =========================

  async findMyCertificates(userId: string) {
    return this.prisma.certificates.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        issued_at: 'desc',
      },
    });
  }

  async createForStudent(
    userId: string,
    dto: CreateStudentCertificateDto,
  ) {
    const courseId = BigInt(dto.course_id);

    // Verify that the student is enrolled.
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

    // Get all lessons for the course.
    const lessons =
      await this.prisma.lessons.findMany({
        where: {
          modules: {
            course_id: courseId,
          },
        },
        select: {
          id: true,
        },
      });

    // Get this student's progress.
    const progress =
      await this.prisma.lesson_progress.findMany({
        where: {
          user_id: userId,
          course_id: courseId,
        },
        select: {
          is_completed: true,
        },
      });

    const totalLessons = lessons.length;

    const completedLessons =
      progress.filter(
        (item) => item.is_completed,
      ).length;

    const isCourseCompleted =
      totalLessons > 0 &&
      completedLessons === totalLessons;

    if (!isCourseCompleted) {
      throw new ForbiddenException(
        'You are not eligible for a certificate yet',
      );
    }

    // The database already enforces one certificate
    // per user/course.
    const existing =
      await this.prisma.certificates.findUnique({
        where: {
          user_id_course_id: {
            user_id: userId,
            course_id: courseId,
          },
        },
      });

    if (existing) {
      throw new ConflictException(
        'Certificate already exists for this course',
      );
    }

    const certificateNumber =
      `CERT-${randomUUID()}`;

    return this.prisma.certificates.create({
      data: {
        user_id: userId,
        course_id: courseId,
        certificate_number: certificateNumber,
      },
    });
  }
}