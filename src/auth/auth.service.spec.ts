import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    public_users: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      public_users: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'FRONTEND_URL') return 'https://makersflow.in';
              if (key === 'SMTP_USER') return 'test@example.com';
              if (key === 'SMTP_APP_PASSWORD') return 'test-password';
              if (key === 'NODE_ENV') return 'test';
              return undefined;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('allows a Google-created account without a password to request a reset', async () => {
    prisma.public_users.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'team.makersflow@gmail.com',
      password_hash: null,
    });

    jest.spyOn(service as any, 'sendResetEmail').mockResolvedValue(undefined);

    const result = await service.forgotPassword('team.makersflow@gmail.com');

    expect(result).toEqual({
      success: true,
      message:
        'If an account with that email exists, a password reset link has been sent.',
    });
    expect(prisma.public_users.update).toHaveBeenCalled();
  });

  it('returns the same generic response for an unknown email', async () => {
    prisma.public_users.findUnique.mockResolvedValue(null);

    const result = await service.forgotPassword('unknown@example.com');

    expect(result).toEqual({
      success: true,
      message:
        'If an account with that email exists, a password reset link has been sent.',
    });
    expect(prisma.public_users.update).not.toHaveBeenCalled();
  });
});
