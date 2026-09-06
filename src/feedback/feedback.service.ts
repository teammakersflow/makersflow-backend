import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  create(
    userId: string,
    createFeedbackDto: CreateFeedbackDto,
  ) {
    return this.prisma.feedback.create({
      data: {
        user_id: userId,
        rating: createFeedbackDto.rating,
        message: createFeedbackDto.message,
      },
    });
  }
}