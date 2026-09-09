import { Module } from '@nestjs/common';

import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
})
export class ChallengesModule {}