import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClaimKitDto } from './dto/claim-kit.dto';
import { IncludedKitsService } from './included-kits.service';

@Controller('included-kits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class IncludedKitsController {
  constructor(private readonly service: IncludedKitsService) {}

  @Get('my')
  findMine(@Request() req: any) {
    return this.service.findMine(req.user.id);
  }

  @Post(':claimId/claim')
  claim(
    @Request() req: any,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: ClaimKitDto,
  ) {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new BadRequestException('Idempotency-Key header (8-128 chars) is required');
    }
    return this.service.claim(req.user.id, claimId, idempotencyKey, dto.shipping_address);
  }
}
