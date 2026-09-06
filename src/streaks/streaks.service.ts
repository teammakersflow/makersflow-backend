import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreaksService {
  constructor(private readonly prisma: PrismaService) {}

  async recordActivity(userId: string) {
    console.log('[STREAK] recordActivity() called:', userId);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const existing = await this.prisma.streaks.findUnique({
      where: {
        user_id: userId,
      },
    });

    console.log('[STREAK] Existing record:', existing);

    // No streak record yet
    if (!existing) {
      const created = await this.prisma.streaks.create({
        data: {
          user_id: userId,
          current_streak: 1,
          longest_streak: 1,
          last_activity_date: today,
          activity_log: [new Date(today)],
        },
      });

      console.log('[STREAK] Created:', created);

      return created;
    }

    const lastActivity = existing.last_activity_date
      ? new Date(existing.last_activity_date)
      : null;

    if (lastActivity) {
      lastActivity.setUTCHours(0, 0, 0, 0);
    }

    // Same day = don't increment again
    if (
      lastActivity &&
      lastActivity.getTime() === today.getTime()
    ) {
      console.log(
        '[STREAK] Activity already recorded today',
      );

      return existing;
    }

    const oneDay = 24 * 60 * 60 * 1000;

    const isConsecutiveDay =
      lastActivity !== null &&
      today.getTime() - lastActivity.getTime() === oneDay;

    const currentStreak = isConsecutiveDay
      ? (existing.current_streak ?? 0) + 1
      : 1;

    const longestStreak = Math.max(
      currentStreak,
      existing.longest_streak ?? 0,
    );

    const activityLog = [
      ...(existing.activity_log ?? []).map(
        (date) => new Date(date),
      ),
      new Date(today),
    ];

    console.log('[STREAK] Activity log BEFORE save:', {
      length: activityLog.length,
      values: activityLog,
    });

    const updated = await this.prisma.streaks.update({
      where: {
        user_id: userId,
      },
      data: {
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_activity_date: today,
        activity_log: {
          set: activityLog,
        },
      },
    });

    console.log('[STREAK] Updated record:', updated);

    return updated;
  }
  async findMyStreak(userId: string) {
    return this.prisma.streaks.findUnique({
      where: {
        user_id: userId,
      },
    });
  }
}