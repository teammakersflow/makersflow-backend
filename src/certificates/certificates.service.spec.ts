import { Test, TestingModule } from '@nestjs/testing';
import { CertificatesService } from './certificates.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CertificatesService', () => {
  let service: CertificatesService;

  beforeEach(async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          CertificatesService,
          {
            provide: PrismaService,
            useValue: {},
          },
        ],
      }).compile();

    service = module.get<CertificatesService>(
      CertificatesService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});