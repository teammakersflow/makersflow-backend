import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto'


@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.public_users.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        full_name: true,
        grade: true,
        school: true,
        avatar_url: true,
        created_at: true,
        role: true,
        notifications_enabled: true,
        onboarding_completed: true,
        is_banned: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      message: 'User fetched successfully',
      data: user,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ) {
    const user = await this.prisma.public_users.update({
      where: {
        id: userId,
      },
      data: dto,
    });

    return {
      success: true,
      message: 'Profile updated successfully',
      data: user,
    };
  }

  async updateRole(
    userId: string,
    role: 'student' | 'instructor' | 'admin',
  ) {
    const user = await this.prisma.public_users.update({
      where: {
        id: userId,
      },
      data: {
        role,
      },
    });

    return {
      success: true,
      message: 'User role updated successfully',
      data: user,
    };
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
    role?: string,
    isBanned?: boolean,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        {
          full_name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isBanned !== undefined) {
      where.is_banned = isBanned;
    }

    const [users, total] = await Promise.all([
      this.prisma.public_users.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
      }),
      this.prisma.public_users.count({
        where,
      }),
    ]);

    return {
      success: true,
      message: 'Users fetched successfully',
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }



  async updateBanStatus(
    userId: string,
    isBanned: boolean,
  ) {
    const user = await this.prisma.public_users.update({
      where: {
        id: userId,
      },
      data: {
        is_banned: isBanned,
      },
    });

    return {
      success: true,
      message: isBanned
        ? 'User banned successfully'
        : 'User unbanned successfully',
      data: user,
    };
  }

async deleteAccount(userId: string) {
  await this.prisma.public_users.delete({
    where: {
      id: userId,
    },
  });

  return {
    success: true,
    message: 'Account deleted successfully',
  };
}
}