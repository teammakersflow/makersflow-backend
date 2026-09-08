import { Module } from '@nestjs/common';

import { WatchLaterService } from './watch-later.service';
import { WatchLaterController } from './watch-later.controller';

@Module({
  controllers: [WatchLaterController],
  providers: [WatchLaterService],
})
export class WatchLaterModule {}
