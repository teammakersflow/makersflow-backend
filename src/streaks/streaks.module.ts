import { Module } from '@nestjs/common';

import { StreaksService } from './streaks.service';
import { StreaksController } from './streaks.controller';

import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StreaksController],
  providers: [StreaksService],
})
export class StreaksModule {}