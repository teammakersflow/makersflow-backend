import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CourseFavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.course_favorites.findMany({
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

    const existing =
      await this.prisma.course_favorites.findFirst({
        where: {
          user_id: userId,
          course_id: courseId,
        },
      });

    if (existing) {
      throw new ConflictException(
        'Course is already in favorites',
      );
    }

    return this.prisma.course_favorites.create({
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
    const favorite =
      await this.prisma.course_favorites.findFirst({
        where: {
          user_id: userId,
          course_id: courseId,
        },
      });

    if (!favorite) {
      throw new NotFoundException(
        'Course is not in favorites',
      );
    }

    await this.prisma.course_favorites.delete({
      where: {
        id: favorite.id,
      },
    });

    return {
      success: true,
      message: 'Course removed from favorites',
    };
  }
}