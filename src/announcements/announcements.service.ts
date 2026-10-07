import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  findAll() {
    return this.prisma.announcements.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findActive() {
    return this.prisma.announcements.findMany({
      where: {
        status: 'published',
        OR: [
          {
            scheduled_at: null,
          },
          {
            scheduled_at: {
              lte: new Date(),
            },
          },
        ],
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const announcement =
      await this.prisma.announcements.findUnique({
        where: {
          id,
        },
      });

    if (!announcement) {
      throw new NotFoundException(
        'Announcement not found',
      );
    }

    return announcement;
  } 

  create(createAnnouncementDto: CreateAnnouncementDto) {
    return this.prisma.announcements.create({
      data: {
        title: createAnnouncementDto.title,
        message: createAnnouncementDto.message,
        type: createAnnouncementDto.type ?? 'info',
        link_url:
          createAnnouncementDto.link_url ?? null,
        status:
          createAnnouncementDto.status ?? 'draft',
        scheduled_at:
          createAnnouncementDto.scheduled_at
            ? new Date(createAnnouncementDto.scheduled_at)
            : null,
      },
    });
  }

  async update(
    id: string,
    updateAnnouncementDto: UpdateAnnouncementDto,
  ) {
    const existing =
      await this.prisma.announcements.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Announcement not found',
      );
    }

    return this.prisma.announcements.update({
      where: {
        id,
      },
      data: {
        ...(updateAnnouncementDto.title !== undefined && {
          title: updateAnnouncementDto.title,
        }),

        ...(updateAnnouncementDto.message !== undefined && {
          message: updateAnnouncementDto.message,
        }),

        ...(updateAnnouncementDto.type !== undefined && {
          type: updateAnnouncementDto.type,
        }),

        ...(updateAnnouncementDto.link_url !== undefined && {
          link_url: updateAnnouncementDto.link_url,
        }),

        ...(updateAnnouncementDto.status !== undefined && {
          status: updateAnnouncementDto.status,
        }),

        ...(updateAnnouncementDto.scheduled_at !== undefined && {
          scheduled_at:
            updateAnnouncementDto.scheduled_at === null
              ? null
              : new Date(updateAnnouncementDto.scheduled_at),
        }),

        updated_at: new Date(),
      },
    });
  }

  async remove(id: string) {
    const existing =
      await this.prisma.announcements.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Announcement not found',
      );
    }

    return this.prisma.announcements.delete({
      where: {
        id,
      },
    });
  }
}
