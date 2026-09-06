import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreaksService {
  constructor(private readonly prisma: PrismaService) {}

  async recordActivity(userId: string) {
    // Use today's date at UTC midnight.
    // The streaks table stores dates, not timestamps.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const existing = await this.prisma.streaks.findUnique({
      where: {
        user_id: userId,
      },
    });

    // No streak record yet
    if (!existing) {
      return this.prisma.streaks.create({
        data: {
          user_id: userId,
          current_streak: 1,
          longest_streak: 1,
          last_activity_date: today,
          activity_log: [today],
        },
      });
    }

    const lastActivity = existing.last_activity_date
      ? new Date(existing.last_activity_date)
      : null;

    if (lastActivity) {
      lastActivity.setUTCHours(0, 0, 0, 0);
    }

    // Same day: don't increment anything.
    if (
      lastActivity &&
      lastActivity.getTime() === today.getTime()
    ) {
      return existing;
    }

    const oneDay = 24 * 60 * 60 * 1000;

    const isConsecutiveDay =
      lastActivity &&
      today.getTime() - lastActivity.getTime() === oneDay;

    const currentStreak = isConsecutiveDay
      ? (existing.current_streak ?? 0) + 1
      : 1;

    const longestStreak = Math.max(
      currentStreak,
      existing.longest_streak ?? 0,
    );

    const activityLog = existing.activity_log ?? [];

    return this.prisma.streaks.update({
      where: {
        user_id: userId,
      },
      data: {
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_activity_date: today,
        activity_log: {
          push: today,
        },
      },
    });
  }

  async findMyStreak(userId: string) {
    return this.prisma.streaks.findUnique({
      where: {
        user_id: userId,
      },
    });
  }
}