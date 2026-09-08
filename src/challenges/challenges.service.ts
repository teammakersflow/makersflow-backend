import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

import { ChallengeRegistrationDto } from './dto/challenge-registration.dto';
import { ChallengeSubmissionDto } from './dto/challenge-submission.dto';

@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async register(dto: ChallengeRegistrationDto) {
    return this.prisma.challenge_registrations.create({
      data: {
        full_name: dto.full_name,
        age: dto.age,
        email: dto.email,
        phone: dto.phone,
        institution: dto.institution,
        class_year: dto.class_year,
        city: dto.city,
        project_category: dto.project_category,
        motivation: dto.motivation,
      },
    });
  }

  async submit(dto: ChallengeSubmissionDto) {
    return this.prisma.challenge_submissions.create({
      data: {
        full_name: dto.full_name,
        age: dto.age,
        institution: dto.institution,
        kit_name: dto.kit_name,
        project_title: dto.project_title,
        description: dto.description,
        problem_solved: dto.problem_solved,
        inspiration: dto.inspiration,
        video_url: dto.video_url,
        image_urls: dto.image_urls,
        feature_consent: dto.feature_consent ?? false,
        status: 'submitted',
      },
    });
  }

  async createMediaUploadUrl(
    fileName: string,
    contentType: string,
  ) {
    return this.storageService.createChallengeUploadUrl(
      fileName,
      contentType,
    );
  }
}