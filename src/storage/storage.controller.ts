import {
  Body,
  Controller,
  Delete,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('storage')
@ApiBearerAuth()
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
  ) {}

  @Post('upload-url')
  @UseGuards(JwtAuthGuard)
  createUploadUrl(
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.storageService.createUploadUrl(
      dto.fileName,
      dto.contentType,
      dto.folder,
    );
  }

  @Delete('object')
  @UseGuards(JwtAuthGuard)
  deleteObject(
    @Query('key') key: string,
  ) {
    return this.storageService.deleteObject(key);
  }
}