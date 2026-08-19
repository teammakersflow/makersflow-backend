import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  findAll() {
    return this.prisma.news.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const news = await this.prisma.news.findUnique({
      where: {
        id: BigInt(id),
      },
    });

    if (!news) {
      throw new NotFoundException('News not found');
    }

    return news;
  }

  create(
    createNewsDto: CreateNewsDto,
    userId: string,
  ) {
    return this.prisma.news.create({
      data: {
        ...createNewsDto,
        created_by: userId,
      },
    });
  }

  async update(
    id: string,
    updateNewsDto: UpdateNewsDto,
  ) {
    const existing = await this.prisma.news.findUnique({
      where: {
        id: BigInt(id),
      },
    });

    if (!existing) {
      throw new NotFoundException('News not found');
    }

    return this.prisma.news.update({
      where: {
        id: BigInt(id),
      },
      data: updateNewsDto,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.news.findUnique({
      where: {
        id: BigInt(id),
      },
    });

    if (!existing) {
      throw new NotFoundException('News not found');
    }

    return this.prisma.news.delete({
      where: {
        id: BigInt(id),
      },
    });
  }
}