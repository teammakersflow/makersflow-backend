import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  @Post('register')
  @ApiOperation({
    summary: 'Register with email and password',
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.registerWithPassword(
      dto.email,
      dto.password,
      dto.fullName,
    );
  }


  @Post('login')
  @ApiOperation({
    summary: 'Login with email and password',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.loginWithPassword(
      dto.email,
      dto.password,
    );
  }

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
  async getCurrentUser(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      success: true,
      message: 'Authenticated user fetched successfully',
      data: await this.authService.getCurrentUser(user.id),
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


  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request a password reset email',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password using a valid reset token',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(
      dto.token,
      dto.newPassword,
    );
  }

}