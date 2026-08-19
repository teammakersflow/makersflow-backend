import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonNoteDto } from './dto/create-lesson-note.dto';
import { UpdateLessonNoteDto } from './dto/update-lesson-note.dto';

@Injectable()
export class LessonNotesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  findAll() {
    return this.prisma.lesson_notes.findMany({
      orderBy: [
        {
          lesson_id: 'asc',
        },
        {
          position: 'asc',
        },
      ],
    });
  }

  async findOne(id: string) {
    const note = await this.prisma.lesson_notes.findUnique({
      where: {
        id,
      },
    });

    if (!note) {
      throw new NotFoundException('Lesson note not found');
    }

    return note;
  }

  create(createLessonNoteDto: CreateLessonNoteDto) {
    return this.prisma.lesson_notes.create({
      data: {
        lesson_id: BigInt(createLessonNoteDto.lesson_id),
        content: createLessonNoteDto.content,
        position: createLessonNoteDto.position ?? 0,
      },
    });
  }

  async update(
    id: string,
    updateLessonNoteDto: UpdateLessonNoteDto,
  ) {
    const existing =
      await this.prisma.lesson_notes.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      throw new NotFoundException('Lesson note not found');
    }

    return this.prisma.lesson_notes.update({
      where: {
        id,
      },
      data: {
        ...(updateLessonNoteDto.lesson_id !== undefined && {
          lesson_id: BigInt(updateLessonNoteDto.lesson_id),
        }),
        ...(updateLessonNoteDto.content !== undefined && {
          content: updateLessonNoteDto.content,
        }),
        ...(updateLessonNoteDto.position !== undefined && {
          position: updateLessonNoteDto.position,
        }),
      },
    });
  }

  async remove(id: string) {
    const existing =
      await this.prisma.lesson_notes.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      throw new NotFoundException('Lesson note not found');
    }

    return this.prisma.lesson_notes.delete({
      where: {
        id,
      },
    });
  }
}