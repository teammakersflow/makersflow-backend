import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreaksService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyStreak(userId: string) {
    return this.prisma.streaks.findUnique({
      where: {
        user_id: userId,
      },
    });
  }
}