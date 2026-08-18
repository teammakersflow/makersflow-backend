import {
  IsArray,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateCourseDto } from './update-course.dto';

export class BulkUpdateCoursesDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsObject()
  @ValidateNested()
  @Type(() => UpdateCourseDto)
  data!: UpdateCourseDto;
}