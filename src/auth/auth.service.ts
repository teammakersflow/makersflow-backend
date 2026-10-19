import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { StringValue } from 'ms';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';


@Injectable()
export class AuthService {
  private client: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    this.client = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }


async registerWithPassword(
  email: string,
  password: string,
  fullName: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = fullName.trim();

  if (!normalizedEmail || !normalizedName || !password) {
    throw new BadRequestException(
      'Email, password, and full name are required',
    );
  }

  const existingUser = await this.prisma.public_users.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new ConflictException(
      'An account with this email already exists',
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await this.prisma.public_users.create({
    data: {
      id: randomUUID(),
      email: normalizedEmail,
      full_name: normalizedName,
      password_hash: passwordHash,
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      avatar_url: true,
      role: true,
    },
  });

  return {
    success: true,
    message: 'Account created successfully. Please sign in.',
    data: { user },
  };
}


async loginWithPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await this.prisma.public_users.findUnique({
    where: { email: normalizedEmail },
  });

  // Use a generic error so we don't reveal whether an account exists.
  if (
    !user ||
    !user.password_hash ||
    !(await bcrypt.compare(password, user.password_hash))
  ) {
    throw new UnauthorizedException('Invalid email or password');
  }

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = await this.jwtService.signAsync(payload, {
    secret: this.configService.get<string>('JWT_SECRET')!,
    expiresIn: this.configService.get<StringValue>('JWT_EXPIRES_IN')!,
  });

  const refreshToken = await this.jwtService.signAsync(payload, {
    secret: this.configService.get<string>('JWT_REFRESH_SECRET')!,
    expiresIn: this.configService.get<StringValue>(
      'JWT_REFRESH_EXPIRES_IN',
    )!,
  });

  const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

  await this.prisma.public_users.update({
    where: { id: user.id },
    data: { hashed_refresh_token: hashedRefreshToken },
  });

  const { password_hash: _passwordHash, hashed_refresh_token: _refreshHash, ...safeUser } = user;

  return {
    success: true,
    message: 'Login successful',
    data: {
      user: safeUser,
      accessToken,
      refreshToken,
    },
  };
}

  // 👇 Add the method here
  async googleLogin(idToken: string) {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      throw new UnauthorizedException(
        'Email not found in Google token',
      );
    }

    let user = await this.prisma.public_users.findUnique({
      where: {
        email: payload.email,
      },
    });

    if (!user) {
      user = await this.prisma.public_users.create({
        data: {
          id: randomUUID(),
          email: payload.email,
          full_name: payload.name,
          avatar_url: payload.picture,
        },
      });
    } else {
      user = await this.prisma.public_users.update({
        where: {
          id: user.id,
        },
        data: {
          ...(payload.name && !user.full_name
            ? { full_name: payload.name }
            : {}),
          ...(payload.picture && !user.avatar_url
            ? { avatar_url: payload.picture }
            : {}),
        },
      });
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        secret: this.configService.get<string>('JWT_SECRET')!,
        expiresIn: this.configService.get<StringValue>('JWT_EXPIRES_IN')!,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET')!,
        expiresIn: this.configService.get<StringValue>(
          'JWT_REFRESH_EXPIRES_IN',
        )!,
      },
    );

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.prisma.public_users.update({
      where: {
        id: user.id,
      },
      data: {
        hashed_refresh_token: hashedRefreshToken,
      },
    });

return {
  success: true,
  message: 'Google authentication successful',
  data: {
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      grade: user.grade,
      school: user.school,
      role: user.role,
    },
    accessToken,
    refreshToken,
  },
};
  }

  async refreshAccessToken(refreshToken: string) {
    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET')!,
    });

    const user = await this.prisma.public_users.findUnique({
      where: {
        id: payload.sub,
      },
    });

    if (!user || !user.hashed_refresh_token) {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    const isMatch = await bcrypt.compare(
      refreshToken,
      user.hashed_refresh_token,
    );

    if (!isMatch) {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        secret: this.configService.get<string>('JWT_SECRET')!,
        expiresIn: this.configService.get<StringValue>('JWT_EXPIRES_IN')!,
      },
    );

    return {
      success: true,
      message: 'Access token refreshed successfully',
      data: {
        accessToken,
      },
    };
  }

  async logout(userId: string) {
    await this.prisma.public_users.update({
      where: {
        id: userId,
      },
      data: {
        hashed_refresh_token: null,
      },
    });

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.public_users.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        avatar_url: true,
        grade: true,
        school: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
