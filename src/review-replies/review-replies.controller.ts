import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ReviewRepliesService } from './review-replies.service';
import { CreateReviewReplyDto } from './dto/create-review-reply.dto';
import { UpdateReviewReplyDto } from './dto/update-review-reply.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('review-replies')
export class ReviewRepliesController {
  constructor(
    private readonly reviewRepliesService: ReviewRepliesService,
  ) {}

  @Get()
  findAll() {
    return this.reviewRepliesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewRepliesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(
    @Body() createReviewReplyDto: CreateReviewReplyDto,
  ) {
    return this.reviewRepliesService.create(
      createReviewReplyDto,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() updateReviewReplyDto: UpdateReviewReplyDto,
  ) {
    return this.reviewRepliesService.update(
      id,
      updateReviewReplyDto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.reviewRepliesService.remove(id);
  }
}
