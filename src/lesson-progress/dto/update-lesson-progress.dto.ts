import { PartialType } from '@nestjs/mapped-types';
import { CreateLessonProgressDto } from './create-lesson-progress.dto';

export class UpdateLessonProgressDto extends PartialType(
  CreateLessonProgressDto,
) {}