import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class CoursesService {
  constructor(
  private prisma: PrismaService,
  private readonly storageService: StorageService,
) {}

  create(createCourseDto: CreateCourseDto) {
    return this.prisma.courses.create({
      data: createCourseDto,
    });
  }

async findAll() {
  const courses = await this.prisma.courses.findMany();

  return Promise.all(
    courses.map(async (course) => ({
      ...course,
      thumbnail_url: await this.storageService.createSignedImageUrl(
        course.thumbnail_url,
      ),
    })),
  );
}


async findOne(id: bigint) {
  const course = await this.prisma.courses.findUnique({
    where: { id },
  });

  if (!course) {
    return null;
  }

  return {
    ...course,
    thumbnail_url: await this.storageService.createSignedImageUrl(
      course.thumbnail_url,
    ),
  };
}


  update(id: bigint, updateCourseDto: UpdateCourseDto) {
    return this.prisma.courses.update({
      where: { id },
      data: updateCourseDto,
    });
  }

  async bulkUpdate(
  ids: string[],
  data: UpdateCourseDto,
) {
  const succeeded: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const id of ids) {
    try {
      await this.prisma.courses.update({
        where: { id: BigInt(id) },
        data,
      });

      succeeded.push(id);
    } catch (error) {
      failed.push({
        id,
        reason: 'Course not found or update failed',
      });
    }
  }

  return {
    succeeded,
    failed,
  };
}

  remove(id: bigint) {
    return this.prisma.courses.delete({
      where: { id },
    });
  }
}