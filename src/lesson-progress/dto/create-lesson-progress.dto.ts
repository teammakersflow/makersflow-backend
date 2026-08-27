import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateLessonProgressDto {
  @IsNumber()
  course_id!: number;

  @IsNumber()
  lesson_id!: number;

  @IsBoolean()
  @IsOptional()
  is_completed?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  current_time_secs?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  watch_percentage?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  time_spent_secs?: number;

  @IsDateString()
  @IsOptional()
  last_watched_at?: string;
}