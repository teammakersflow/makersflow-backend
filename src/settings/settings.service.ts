import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  findAll(keys?: string[]) {
    return this.prisma.settings.findMany({
      where: keys?.length
        ? {
            key: {
              in: keys,
            },
          }
        : undefined,
      orderBy: {
        key: 'asc',
      },
    });
  }

  async findOne(key: string) {
    const setting = await this.prisma.settings.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }

    return setting;
  }

  create(createSettingDto: CreateSettingDto) {
    return this.prisma.settings.create({
      data: createSettingDto,
    });
  }

  update(key: string, updateSettingDto: UpdateSettingDto) {
    return this.prisma.settings.update({
      where: { key },
      data: {
        ...updateSettingDto,
        updated_at: new Date(),
      },
    });
  }

  upsert(createSettingDto: CreateSettingDto) {
    return this.prisma.settings.upsert({
      where: {
        key: createSettingDto.key,
      },
      create: createSettingDto,
      update: {
        value: createSettingDto.value,
        label: createSettingDto.label,
        updated_at: new Date(),
      },
    });
  }

  async remove(key: string) {
    const setting = await this.prisma.settings.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }

    return this.prisma.settings.delete({
      where: { key },
    });
  }
}