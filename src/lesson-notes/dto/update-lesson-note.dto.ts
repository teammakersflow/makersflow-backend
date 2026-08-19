import { PartialType } from '@nestjs/mapped-types';
import { CreateLessonNoteDto } from './create-lesson-note.dto';

export class UpdateLessonNoteDto extends PartialType(
  CreateLessonNoteDto,
) {}