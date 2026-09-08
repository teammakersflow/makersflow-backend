import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WatchLaterService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.watch_later.findMany({
      where: {
        user_id: userId,
      },
      include: {
        courses: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async add(userId: string, courseId: bigint) {
    const course = await this.prisma.courses.findUnique({
      where: {
        id: courseId,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const existing = await this.prisma.watch_later.findFirst({
      where: {
        user_id: userId,
        course_id: courseId,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Course is already in watch later',
      );
    }

    return this.prisma.watch_later.create({
      data: {
        user_id: userId,
        course_id: courseId,
      },
      include: {
        courses: true,
      },
    });
  }

  async remove(userId: string, courseId: bigint) {
    const watchLater = await this.prisma.watch_later.findFirst({
      where: {
        user_id: userId,
        course_id: courseId,
      },
    });

    if (!watchLater) {
      throw new NotFoundException(
        'Course is not in watch later',
      );
    }

    await this.prisma.watch_later.delete({
      where: {
        id: watchLater.id,
      },
    });

    return {
      success: true,
      message: 'Course removed from watch later',
    };
  }
}
