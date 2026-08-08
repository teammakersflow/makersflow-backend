import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WhatsappOtpService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllOtps() {
    return this.prisma.whatsapp_otps.findMany();
  }
}