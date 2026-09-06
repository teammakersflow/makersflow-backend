import { Module } from '@nestjs/common';

import { SecurityLogsService } from './security-logs.service';
import { SecurityLogsController } from './security-logs.controller';

import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SecurityLogsController],
  providers: [SecurityLogsService],
})
export class SecurityLogsModule {}