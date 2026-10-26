import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { IncludedKitsController } from './included-kits.controller';
import { IncludedKitsService } from './included-kits.service';

@Module({
  imports: [ProductsModule],
  controllers: [IncludedKitsController],
  providers: [IncludedKitsService],
})
export class IncludedKitsModule {}
