import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { KitsController } from './kits.controller';
import { KitsService } from './kits.service';

@Module({
  imports: [StorageModule],
  controllers: [KitsController],
  providers: [KitsService],
})
export class KitsModule {}
