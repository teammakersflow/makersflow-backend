const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

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

type SentMail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
};

describe('AuthService welcome email', () => {
  let service: AuthService;
  let prisma: {
    public_users: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let logError: jest.SpyInstance;

  const createdUser = {
    id: 'user-new',
    email: 'anu@example.com',
    full_name: 'Anu Shree',
    avatar_url: null,
    role: 'student',
  };

  /** Let the fire-and-forget email promise run to completion. */
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  const sentMails = () =>
    (mockSendMail.mock.calls as Array<[SentMail]>).map(([mail]) => mail);

  const welcomeCalls = () =>
    sentMails().filter((mail) =>
      mail.subject.startsWith('Welcome to MakersFlow'),
    );

  beforeEach(async () => {
    mockSendMail.mockReset().mockResolvedValue({ messageId: 'm1' });

    prisma = {
      public_users: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdUser),
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({ ...createdUser, ...data }),
          ),
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
              if (key === 'SMTP_USER') return 'team@makersflow.in';
              if (key === 'SMTP_APP_PASSWORD') return 'test-password';
              if (key === 'NODE_ENV') return 'test';
              return 'test-value';
            }),
          },
        },
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('signed.jwt') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const mockGoogleToken = (email: string, name?: string) => {
    const { client } = service as unknown as { client: OAuth2Client };
    (jest.spyOn(client, 'verifyIdToken') as jest.SpyInstance).mockResolvedValue(
      {
        getPayload: () => ({ email, name, picture: undefined }),
      },
    );
  };

  it('sends one welcome email after email + password sign-up', async () => {
    await service.registerWithPassword(
      'Anu@Example.com ',
      'Password123!',
      'Anu Shree',
    );
    await flush();

    expect(welcomeCalls()).toHaveLength(1);
    const [mail] = welcomeCalls();
    expect(mail).toMatchObject({
      from: '"MakersFlow" <team@makersflow.in>',
      to: 'anu@example.com',
    });
    expect(mail.subject).toContain('Welcome to MakersFlow');
    // Member 1's template greets by first name and links to /explore.
    expect(mail.html).toContain('Hi Anu,');
    expect(mail.html).toContain('anu@example.com');
    expect(mail.html).toContain('https://makersflow.in/explore');
    expect(mail.text).toContain('Hi Anu,');
  });

  it('does not wait for the email before finishing sign-up', async () => {
    mockSendMail.mockReturnValue(new Promise(() => undefined)); // never settles

    const result = await service.registerWithPassword(
      'anu@example.com',
      'Password123!',
      'Anu Shree',
    );

    expect(result.success).toBe(true);
  });

  it('still signs the user up when the email fails, and logs the user id', async () => {
    mockSendMail.mockRejectedValue(
      new Error('Invalid login: 535 bad credentials'),
    );

    const result = await service.registerWithPassword(
      'anu@example.com',
      'Password123!',
      'Anu Shree',
    );
    await flush();

    expect(result).toMatchObject({
      success: true,
      data: { user: createdUser },
    });
    expect(logError).toHaveBeenCalledWith(
      'Welcome email failed for user user-new',
      expect.stringContaining('535 bad credentials'),
    );
  });

  it('sends no welcome email when sign-up fails because the email exists', async () => {
    prisma.public_users.findUnique.mockResolvedValue(createdUser);

    await expect(
      service.registerWithPassword(
        'anu@example.com',
        'Password123!',
        'Anu Shree',
      ),
    ).rejects.toThrow('An account with this email already exists');
    await flush();

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('sends one welcome email on the first Google sign-in', async () => {
    mockGoogleToken('anu@example.com', 'Anu Shree');

    const result = await service.googleLogin('google-id-token');
    await flush();

    expect(result.success).toBe(true);
    expect(prisma.public_users.create).toHaveBeenCalledTimes(1);
    expect(welcomeCalls()).toHaveLength(1);
    expect(welcomeCalls()[0].to).toBe('anu@example.com');
  });

  it('sends no email when an existing user signs in with Google', async () => {
    prisma.public_users.findUnique.mockResolvedValue(createdUser);
    mockGoogleToken('anu@example.com', 'Anu Shree');

    await service.googleLogin('google-id-token');
    await flush();

    expect(prisma.public_users.create).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('sends no email on a normal password login', async () => {
    prisma.public_users.findUnique.mockResolvedValue({
      ...createdUser,
      password_hash: await bcrypt.hash('Password123!', 4),
      hashed_refresh_token: null,
    });

    await service.loginWithPassword('anu@example.com', 'Password123!');
    await flush();

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('sends only the reset email on password reset', async () => {
    prisma.public_users.findUnique.mockResolvedValue(createdUser);

    await service.forgotPassword('anu@example.com');
    await flush();

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(sentMails()[0].subject).toBe('Reset your MakersFlow password');
    expect(welcomeCalls()).toHaveLength(0);
  });
});
