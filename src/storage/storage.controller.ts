import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import { StorageService } from './storage.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload-url')
  @UseGuards(JwtAuthGuard)
 createUploadUrl(@Body() dto: CreateUploadUrlDto) {
  return this.storageService.createUploadUrl(
    dto.fileName,
    dto.contentType,
    dto.folder,
  );
}
}