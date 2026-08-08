import { Injectable } from '@nestjs/common';
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
}