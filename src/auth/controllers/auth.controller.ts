import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
} from '@nestjs/common';

import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AuthService } from '../services/auth.service';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { RefreshTokenDto } from '../dto/refresh-token.dto';




@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google')
  @ApiOperation({
    summary: 'Verify Google ID Token',
    description: 'Verifies the Google ID Token sent by the mobile app.',
  })
  async googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto.idToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current logged in user',
  })
  getCurrentUser(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      success: true,
      message: 'Authenticated user fetched successfully',
      data: user,
    };
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
  })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
  ) {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout current user',
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.logout(user.id);
  }
}