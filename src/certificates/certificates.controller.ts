import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';

import { CertificatesService } from './certificates.service';

import { CreateCertificateDto } from './dto/create-certificate.dto';
import { CreateStudentCertificateDto } from './dto/create-student-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('certificates')
export class CertificatesController {
  constructor(
    private readonly certificatesService: CertificatesService,
  ) {}

  // =========================
  // ADMIN ROUTES
  // =========================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(
    @Body() createCertificateDto: CreateCertificateDto,
  ) {
    return this.certificatesService.create(
      createCertificateDto,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.certificatesService.findAll();
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() updateCertificateDto: UpdateCertificateDto,
  ) {
    return this.certificatesService.update(
      id,
      updateCertificateDto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.certificatesService.remove(id);
  }

  // =========================
  // STUDENT ROUTES
  // =========================

  @Post('me')
  @UseGuards(JwtAuthGuard)
  createForMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStudentCertificateDto,
  ) {
    return this.certificatesService.createForStudent(
      user.id,
      dto,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMyCertificates(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.findMyCertificates(
      user.id,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.certificatesService.findOne(id);
  }
}