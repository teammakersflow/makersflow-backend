import {
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateWaitlistDto } from './dto/create-waitlist.dto';

@Injectable()
export class WaitlistService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: CreateWaitlistDto) {
    const existing =
      await this.prisma.waitlist_signups.findUnique({
        where: {
          email: dto.email,
        },
      });

    if (existing) {
      throw new ConflictException(
        'Email is already registered on the waitlist',
      );
    }

    return this.prisma.waitlist_signups.create({
      data: {
        email: dto.email,
      },
    });
  }
}