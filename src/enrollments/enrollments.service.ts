import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  create(createEnrollmentDto: CreateEnrollmentDto) {
    return this.prisma.enrollments.create({
      data: createEnrollmentDto,
    });
  }

  findAll() {
    return this.prisma.enrollments.findMany();
  }

  findOne(id: string) {
    return this.prisma.enrollments.findUnique({
      where: { id },
    });
  }

  update(id: string, updateEnrollmentDto: UpdateEnrollmentDto) {
    return this.prisma.enrollments.update({
      where: { id },
      data: updateEnrollmentDto,
    });
  }

  remove(id: string) {
    return this.prisma.enrollments.delete({
      where: { id },
    });
  }
}