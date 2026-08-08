import { Module } from '@nestjs/common';
import { WhatsappOtpService } from './whatsapp-otp.service';

@Module({
  providers: [WhatsappOtpService]
})
export class WhatsappOtpModule {}
