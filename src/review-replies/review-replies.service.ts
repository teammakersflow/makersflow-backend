import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewReplyDto } from './dto/create-review-reply.dto';
import { UpdateReviewReplyDto } from './dto/update-review-reply.dto';

@Injectable()
export class ReviewRepliesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  findAll() {
    return this.prisma.review_replies.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const reply = await this.prisma.review_replies.findUnique({
      where: { id },
    });

    if (!reply) {
      throw new NotFoundException('Review reply not found');
    }

    return reply;
  }

  create(createReviewReplyDto: CreateReviewReplyDto) {
    return this.prisma.review_replies.create({
      data: {
        review_id: createReviewReplyDto.review_id,
        content: createReviewReplyDto.content,
      },
    });
  }

  async update(
    id: string,
    updateReviewReplyDto: UpdateReviewReplyDto,
  ) {
    await this.findOne(id);

    return this.prisma.review_replies.update({
      where: { id },
      data: {
        ...(updateReviewReplyDto.review_id !== undefined && {
          review_id: updateReviewReplyDto.review_id,
        }),
        ...(updateReviewReplyDto.content !== undefined && {
          content: updateReviewReplyDto.content,
        }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.review_replies.delete({
      where: { id },
    });
  }
}
