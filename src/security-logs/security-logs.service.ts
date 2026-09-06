import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SecurityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.login_events.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async remove(id: string, userId: string) {
    const log = await this.prisma.login_events.findFirst({
      where: {
        id,
        user_id: userId,
      },
    });

    if (!log) {
      throw new NotFoundException('Security log not found');
    }

    return this.prisma.login_events.delete({
      where: {
        id: log.id,
      },
    });
  }
}