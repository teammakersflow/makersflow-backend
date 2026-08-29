import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';

import { WishlistService } from './wishlist.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(
    private readonly wishlistService: WishlistService,
  ) {}

  @Get('me')
  findMyWishlist(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wishlistService.findMyWishlist(
      user.id,
    );
  }

  @Post(':productId')
  addToWishlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.addToWishlist(
      user.id,
      BigInt(productId),
    );
  }

    @Delete(':productId')
  removeFromWishlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.removeFromWishlist(
      user.id,
      BigInt(productId),
    );
  }
}