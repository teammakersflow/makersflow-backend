import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  create(createNotificationDto: CreateNotificationDto) {
    return this.prisma.notifications.create({
      data: createNotificationDto,
    });
  }

  findAll() {
    return this.prisma.notifications.findMany();
  }

  findOne(id: string) {
    return this.prisma.notifications.findUnique({
      where: { id },
    });
  }

  update(id: string, updateNotificationDto: UpdateNotificationDto) {
    return this.prisma.notifications.update({
      where: { id },
      data: updateNotificationDto,
    });
  }

  remove(id: string) {
    return this.prisma.notifications.delete({
      where: { id },
    });
  }

  async findMyNotifications(userId: string) {
  return this.prisma.notifications.findMany({
    where: {
      user_id: userId,
    },
    orderBy: {
      created_at: 'desc',
    },
  });
}

async getUnreadCount(userId: string) {
  const count = await this.prisma.notifications.count({
    where: {
      user_id: userId,
      is_read: false,
    },
  });

  return {
    count,
  };
}

async markAsRead(userId: string, id: string) {
  return this.prisma.notifications.updateMany({
    where: {
      id,
      user_id: userId,
    },
    data: {
      is_read: true,
    },
  });
}

/** Deletes one of the caller's own notifications; 404 if it is not theirs. */
async deleteMine(userId: string, id: string) {
  const result = await this.prisma.notifications.deleteMany({
    where: {
      id,
      user_id: userId,
    },
  });

  if (result.count === 0) {
    throw new NotFoundException('Notification not found');
  }

  return { success: true };
}
}