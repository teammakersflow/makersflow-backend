import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================
  // EXISTING / ADMIN METHODS
  // =========================

  create(
    createReviewDto: CreateReviewDto,
    userId: string,
  ) {
    return this.prisma.reviews.create({
      data: {
        ...createReviewDto,
        course_id: BigInt(createReviewDto.course_id),
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
      where: {
        id,
        status: 'approved',
      },
    });
  }

  async update(
    id: string,
    updateReviewDto: UpdateReviewDto,
    userId: string,
  ) {
    const review = await this.prisma.reviews.findUnique({
      where: {
        id,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.user_id !== userId) {
      throw new ForbiddenException(
        'You can only update your own review',
      );
    }

    return this.prisma.reviews.update({
      where: {
        id,
      },
      data: {
        ...(updateReviewDto.rating !== undefined && {
          rating: updateReviewDto.rating,
        }),

        ...(updateReviewDto.comment !== undefined && {
          comment: updateReviewDto.comment,
        }),

      },
    });
  }

  remove(id: string) {
    return this.prisma.reviews.delete({
      where: {
        id,
      },
    });
  }

  // =========================
  // STUDENT COURSE REVIEWS
  // =========================

  async findMyReviews(userId: string) {
  const [courseReviews, productReviews] =
    await Promise.all([
      this.prisma.reviews.findMany({
        where: {
          user_id: userId,
        },
        select: {
          id: true,
          user_id: true,
          course_id: true,
          rating: true,
          comment: true,
          approved_comment: true,
          status: true,
          created_at: true,
          courses: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      }),

      this.prisma.product_reviews.findMany({
        where: {
          user_id: userId,
        },
        select: {
          id: true,
          user_id: true,
          product_id: true,
          rating: true,
          comment: true,
          approved_comment: true,
          status: true,
          created_at: true,
          products: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      }),
    ]);

  return {
    course_reviews: courseReviews,
    product_reviews: productReviews,
  };
}


  async findCourseReviews(courseId: bigint) {
    const course = await this.prisma.courses.findUnique({
      where: {
        id: courseId,
      },
      select: {
        id: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const reviews = await this.prisma.reviews.findMany({
      where: {
        course_id: courseId,
        status: 'approved',
      },
      select: {
        id: true,
        user_id: true,
        course_id: true,
        rating: true,
        comment: true,
        approved_comment: true,
        created_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const userIds = [...new Set(reviews.map((review) => review.user_id))];

    const users = await this.prisma.public_users.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        full_name: true,
        avatar_url: true,
      },
    });

    const usersById = new Map(users.map((user) => [user.id, user]));

    return reviews.map((review) => ({
      ...review,
      users: usersById.get(review.user_id) ?? null,
    }));

  }


  async findMyCourseReview(
    userId: string,
    courseId: bigint,
  ) {
    const course = await this.prisma.courses.findUnique({
      where: {
        id: courseId,
      },
      select: {
        id: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.prisma.reviews.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
    });
  }

  async submitCourseReview(
    userId: string,
    courseId: bigint,
    submitReviewDto: SubmitReviewDto,
  ) {
    const course = await this.prisma.courses.findUnique({
      where: {
        id: courseId,
      },
      select: {
        id: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.prisma.reviews.upsert({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },

      create: {
        user_id: userId,
        course_id: courseId,
        rating: submitReviewDto.rating,
        comment: submitReviewDto.comment,
        status: 'pending',
      },

      update: {
        rating: submitReviewDto.rating,
        comment: submitReviewDto.comment,
        status: 'pending',
      },
    });
  }

    // =========================
  // STUDENT PRODUCT REVIEWS
  // =========================

  
async findProductReviews(productId: bigint) {
  const product = await this.prisma.products.findUnique({
    where: {
      id: productId,
    },
    select: {
      id: true,
    },
  });

  if (!product) {
    throw new NotFoundException('Product not found');
  }

  const reviews = await this.prisma.product_reviews.findMany({
    where: {
      product_id: productId,
      status: 'approved',
    },
    select: {
      id: true,
      user_id: true,
      product_id: true,
      rating: true,
      comment: true,
      approved_comment: true,
      created_at: true,
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  const userIds = [...new Set(reviews.map((review) => review.user_id))];

  const users = await this.prisma.public_users.findMany({
    where: {
      id: { in: userIds },
    },
    select: {
      id: true,
      full_name: true,
      avatar_url: true,
    },
  });

  const usersById = new Map(users.map((user) => [user.id, user]));

  return reviews.map((review) => ({
    ...review,
    users: usersById.get(review.user_id) ?? null,
  }));
}


  async findMyProductReview(
    userId: string,
    productId: bigint,
  ) {
    const product = await this.prisma.products.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product_reviews.findUnique({
      where: {
        user_id_product_id: {
          user_id: userId,
          product_id: productId,
        },
      },
    });
  }

  async submitProductReview(
    userId: string,
    productId: bigint,
    submitReviewDto: SubmitReviewDto,
  ) {
    const product = await this.prisma.products.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product_reviews.upsert({
      where: {
        user_id_product_id: {
          user_id: userId,
          product_id: productId,
        },
      },

      create: {
        user_id: userId,
        product_id: productId,
        rating: submitReviewDto.rating,
        comment: submitReviewDto.comment,
        status: 'pending',
      },

      update: {
        rating: submitReviewDto.rating,
        comment: submitReviewDto.comment,
        status: 'pending',
      },
    });
  }

    // =========================
  // RATING SUMMARIES
  // =========================

  async findCourseRatingSummaries() {
    return this.prisma.reviews.groupBy({
      by: ['course_id'],
      where: {
        status: 'approved',
      },
      _avg: {
        rating: true,
      },
      _count: {
        id: true,
      },
    });
  }

  async findProductRatingSummaries() {
    return this.prisma.product_reviews.groupBy({
      by: ['product_id'],
      where: {
        status: 'approved',
      },
      _avg: {
        rating: true,
      },
      _count: {
        id: true,
      },
    });
  }

  
  async updateStatus(
    id: string,
    status: 'pending' | 'approved' | 'rejected',
  ) {
    return this.prisma.reviews.update({
      where: { id },
      data: { status },
    });
  }
}