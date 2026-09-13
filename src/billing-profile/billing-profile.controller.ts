import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { BillingProfileService } from './billing-profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateBillingProfileDto } from './dto/update-billing-profile.dto';

@Controller('billing-profile')
@UseGuards(JwtAuthGuard)
export class BillingProfileController {
  constructor(
    private readonly billingProfileService: BillingProfileService,
  ) {}

  @Get('me')
  getMyBillingProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.billingProfileService.getMyBillingProfile(user.id);
  }

  @Patch('me')
  updateMyBillingProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateBillingProfileDto: UpdateBillingProfileDto,
  ) {
    return this.billingProfileService.updateMyBillingProfile(
      user.id,
      updateBillingProfileDto,
    );
  }
}