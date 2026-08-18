import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { CreateReviewDto } from './dto/create-review.dto';

import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  create(
    createReviewDto: CreateReviewDto,
    userId: string,
  ) {
    return this.prisma.reviews.create({
      data: {
        ...createReviewDto,
        user_id: userId,
        status: 'pending',
      },
    });
  }

  async findAll(include: string[] = []) {
    const includeUser = include.includes('user');
    const includeCourse = include.includes('course');

    return this.prisma.reviews.findMany({
      include: {
        users: includeUser
          ? {
              select: {
                id: true,
                email: true,
                full_name: true,
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
  }

  findOne(id: string) {
    return this.prisma.reviews.findUnique({
      where: { id },
    });
  }

  async update(
    id: string,
    updateReviewDto: UpdateReviewDto,
    userId: string,
  ) {
    const review = await this.prisma.reviews.findUnique({
      where: { id },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    if (review.user_id !== userId) {
      throw new Error('You can only update your own review');
    }

    return this.prisma.reviews.update({
      where: { id },
      data: updateReviewDto,
    });
  }

  remove(id: string) {
    return this.prisma.reviews.delete({
      where: { id },
    });
  }
}