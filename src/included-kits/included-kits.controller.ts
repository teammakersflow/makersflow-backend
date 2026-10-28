import {
  Body,
  Controller,
  Post,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClaimIncludedKitDto } from './dto/claim-included-kit.dto';
import { VerifyIncludedKitPaymentDto } from './dto/verify-included-kit-payment.dto';
import { IncludedKitsService } from './included-kits.service';

@ApiTags('Included Kits')
@ApiBearerAuth()
@Controller('included-kits')
@UseGuards(JwtAuthGuard)
export class IncludedKitsController {
  constructor(
    private readonly includedKitsService: IncludedKitsService,
  ) {}

  @Get('my')
  findMine(@Req() req: Request) {
    return this.includedKitsService.findMine((req as any).user.id);
  }

  // Existing method — keep it unchanged
  @Post('claim')
  async claim(
    @Req() req: Request,
    @Body() dto: ClaimIncludedKitDto,
  ) {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new UnauthorizedException(
        'User is not authenticated. Please login first.',
      );
    }

    return this.includedKitsService.claim(userId, dto);
  }

  // ADD THIS METHOD immediately after claim()
  @Post('verify-payment')
  async verifyPayment(
    @Req() req: Request,
    @Body() dto: VerifyIncludedKitPaymentDto,
  ) {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new UnauthorizedException(
        'User is not authenticated. Please login first.',
      );
    }

    return this.includedKitsService.verifyPayment(userId, dto);
  }
}