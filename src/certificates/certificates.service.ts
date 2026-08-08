import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  create(createCertificateDto: CreateCertificateDto) {
    return this.prisma.certificates.create({
      data: createCertificateDto,
    });
  }

  findAll() {
    return this.prisma.certificates.findMany();
  }

  findOne(id: string) {
    return this.prisma.certificates.findUnique({
      where: { id },
    });
  }

  update(id: string, updateCertificateDto: UpdateCertificateDto) {
    return this.prisma.certificates.update({
      where: { id },
      data: updateCertificateDto,
    });
  }

  remove(id: string) {
    return this.prisma.certificates.delete({
      where: { id },
    });
  }
}