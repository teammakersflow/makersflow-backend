import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { ChallengesService } from './challenges.service';
import { ChallengeRegistrationDto } from './dto/challenge-registration.dto';
import { ChallengeSubmissionDto } from './dto/challenge-submission.dto';
import { CreateChallengeMediaUploadUrlDto } from './dto/create-challenge-media-upload-url.dto';

@Controller('challenges')
export class ChallengesController {
  constructor(
    private readonly challengesService: ChallengesService,
  ) {}

  @Post('register')
  register(@Body() dto: ChallengeRegistrationDto) {
    return this.challengesService.register(dto);
  }

  @Post('submissions')
  submit(@Body() dto: ChallengeSubmissionDto) {
    return this.challengesService.submit(dto);
  }

  @Post('media/upload-url')
  createMediaUploadUrl(
    @Body() dto: CreateChallengeMediaUploadUrlDto,
  ) {
    return this.challengesService.createMediaUploadUrl(
      dto.fileName,
      dto.contentType,
    );
  }
}