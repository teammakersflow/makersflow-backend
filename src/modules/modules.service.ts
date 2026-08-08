import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

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