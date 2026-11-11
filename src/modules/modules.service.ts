import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

/** Fields of a module that are safe to show to anyone (curriculum metadata). */
export const PUBLIC_MODULE_FIELDS = {
  id: true,
  course_id: true,
  title: true,
  description: true,
  order_index: true,
  order: true,
  duration_mins: true,
  created_at: true,
} as const;

@Injectable()
export class ModulesService {
  constructor(private prisma: PrismaService) {}

  create(createModuleDto: CreateModuleDto) {
    return this.prisma.modules.create({
      data: createModuleDto,
    });
  }

  findAll() {
    return this.prisma.modules.findMany();
  }

  // B-1 (2026-11-11): public reads use an explicit allow-list of fields.
  findAllPublic() {
    return this.prisma.modules.findMany({
      select: PUBLIC_MODULE_FIELDS,
    });
  }

  findOnePublic(id: bigint) {
    return this.prisma.modules.findUnique({
      where: { id },
      select: PUBLIC_MODULE_FIELDS,
    });
  }

  findOne(id: bigint) {
    return this.prisma.modules.findUnique({
      where: { id },
    });
  }

  update(id: bigint, updateModuleDto: UpdateModuleDto) {
    return this.prisma.modules.update({
      where: { id },
      data: updateModuleDto,
    });
  }

  remove(id: bigint) {
    return this.prisma.modules.delete({
      where: { id },
    });
  }
}