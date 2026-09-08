import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const streaks = await this.prisma.streaks.findMany({
      orderBy: [
        {
          longest_streak: 'desc',
        },
        {
          current_streak: 'desc',
        },
      ],
      take: 10,
    });

    const userIds = streaks.map((streak) => streak.user_id);

    const profiles = await this.prisma.profiles.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        full_name: true,
        avatar_url: true,
      },
    });

    const profileMap = new Map<
      string,
      (typeof profiles)[number]
    >(
      profiles.map((profile) => [profile.id, profile]),
    );

    return streaks.map((streak, index) => {
      const profile = profileMap.get(streak.user_id);

      return {
        rank: index + 1,
        user_id: streak.user_id,
        name: profile?.full_name ?? null,
        avatar: profile?.avatar_url ?? null,
        longest_streak: streak.longest_streak ?? 0,
      };
    });
  }
}