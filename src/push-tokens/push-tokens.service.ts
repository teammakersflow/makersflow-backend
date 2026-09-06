import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreatePushTokenDto } from './dto/create-push-token.dto';

@Injectable()
export class PushTokensService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    userId: string,
    createPushTokenDto: CreatePushTokenDto,
  ) {
    return this.prisma.push_tokens.upsert({
      where: {
        user_id_token: {
          user_id: userId,
          token: createPushTokenDto.token,
        },
      },
      update: {
        platform: createPushTokenDto.platform,
        device_info: createPushTokenDto.device_info,
        updated_at: new Date(),
      },
      create: {
        user_id: userId,
        token: createPushTokenDto.token,
        platform: createPushTokenDto.platform,
        device_info: createPushTokenDto.device_info,
      },
    });
  }

  async remove(
    id: string,
    userId: string,
  ) {
    const token =
      await this.prisma.push_tokens.findFirst({
        where: {
          id,
          user_id: userId,
        },
      });

    if (!token) {
      throw new NotFoundException(
        'Push token not found',
      );
    }

    return this.prisma.push_tokens.delete({
      where: {
        id,
      },
    });
  }
  findMyTokens(userId: string) {
  return this.prisma.push_tokens.findMany({
    where: {
      user_id: userId,
    },
  });
}
}