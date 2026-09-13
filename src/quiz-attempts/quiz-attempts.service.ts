import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class QuizAttemptsService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.quiz_attempts.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        attempted_at: 'desc',
      },
      select: {
        id: true,
        quiz_id: true,
        lesson_id: true,
        score: true,
        answers: true,
        attempted_at: true,
      },
    });
  }
}