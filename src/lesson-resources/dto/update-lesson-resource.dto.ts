import { PartialType } from '@nestjs/mapped-types';
import { CreateLessonResourceDto } from './create-lesson-resource.dto';

export class UpdateLessonResourceDto extends PartialType(
  CreateLessonResourceDto,
) {}