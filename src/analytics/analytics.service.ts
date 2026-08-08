import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    students,
    courses,
    sales,
    certificates,
    revenue,
    watchTime,
    activeUsers,
  ] = await Promise.all([
    this.prisma.public_users.count(),

    this.prisma.courses.count(),

    this.prisma.orders.count(),

    this.prisma.certificates.count(),

    this.prisma.payments.aggregate({
      where: {
        status: 'captured',
      },
      _sum: {
        amount: true,
      },
    }),

    this.prisma.lesson_progress.aggregate({
      _sum: {
        time_spent_secs: true,
      },
    }),

    this.prisma.login_events.findMany({
      where: {
        created_at: {
          gte: thirtyDaysAgo,
        },
      },
      distinct: ['user_id'],
    }),
  ]);

  return {
    revenue: revenue._sum.amount ?? 0,
    students,
    courses,
    sales,
    certificates,
    watchTime: watchTime._sum.time_spent_secs ?? 0,
    activeUsers: activeUsers.length,
  };
}
}