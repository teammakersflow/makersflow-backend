import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  create(createReviewDto: CreateReviewDto) {
    return this.prisma.reviews.create({
      data: createReviewDto,
    });
  }

  findAll() {
    return this.prisma.reviews.findMany();
  }

  findOne(id: string) {
    return this.prisma.reviews.findUnique({
      where: { id },
    });
  }

  update(id: string, updateReviewDto: UpdateReviewDto) {
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