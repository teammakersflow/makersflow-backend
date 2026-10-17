import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';

import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
  ) {}

  // =========================
  // STUDENT COURSE REVIEWS
  // =========================

  @Get('course/:courseId')
  findCourseReviews(
    @Param('courseId') courseId: string,
  ) {
    return this.reviewsService.findCourseReviews(
      BigInt(courseId),
    );
  }

  @Get('course/:courseId/my')
  @UseGuards(JwtAuthGuard)
  findMyCourseReview(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.findMyCourseReview(
      user.id,
      BigInt(courseId),
    );
  }

  @Post('course/:courseId')
  @UseGuards(JwtAuthGuard)
  submitCourseReview(
    @Param('courseId') courseId: string,
    @Body() submitReviewDto: SubmitReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.submitCourseReview(
      user.id,
      BigInt(courseId),
      submitReviewDto,
    );
  }

    // =========================
  // STUDENT PRODUCT REVIEWS
  // =========================

  @Get('product/:productId')
  findProductReviews(
    @Param('productId') productId: string,
  ) {
    return this.reviewsService.findProductReviews(
      BigInt(productId),
    );
  }

  @Get('product/:productId/my')
  @UseGuards(JwtAuthGuard)
  findMyProductReview(
    @Param('productId') productId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.findMyProductReview(
      user.id,
      BigInt(productId),
    );
  }

  @Post('product/:productId')
  @UseGuards(JwtAuthGuard)
  submitProductReview(
    @Param('productId') productId: string,
    @Body() submitReviewDto: SubmitReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.submitProductReview(
      user.id,
      BigInt(productId),
      submitReviewDto,
    );
  }

    // =========================
  // RATING SUMMARIES
  // =========================

  @Get('ratings/courses')
  findCourseRatingSummaries() {
    return this.reviewsService.findCourseRatingSummaries();
  }

  @Get('ratings/products')
  findProductRatingSummaries() {
    return this.reviewsService.findProductRatingSummaries();
  }
  
  // =========================
  // EXISTING ROUTES
  // =========================

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createReviewDto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.create(
      createReviewDto,
      user.id,
    );
  }

  @Get()
  findAll(@Query('include') include?: string) {
    const includes =
      include
        ?.split(',')
        .map((item) => item.trim())
        .filter(Boolean) ?? [];

    return this.reviewsService.findAll(includes);
  }

  @Get('me')
@UseGuards(JwtAuthGuard)
findMyReviews(
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.reviewsService.findMyReviews(user.id);
}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviewsService.updateStatus(
      id,
      dto.status,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.update(
      id,
      updateReviewDto,
      user.id,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}