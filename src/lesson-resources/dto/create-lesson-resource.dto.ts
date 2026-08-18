import {
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLessonResourceDto {
  @IsInt()
  lesson_id!: number;

  @IsString()
  title!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsInt()
  size_bytes?: number;
}