import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { WaitlistService } from './waitlist.service';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';

@Controller('waitlist')
export class WaitlistController {
  constructor(
    private readonly waitlistService: WaitlistService,
  ) {}

  @Post()
  register(@Body() dto: CreateWaitlistDto) {
    return this.waitlistService.register(dto);
  }
}