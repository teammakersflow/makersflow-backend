import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateLessonProgressDto {
  @IsUUID()
  @IsNotEmpty()
  user_id!: string;

  @IsNumber()
  @IsNotEmpty()
  course_id!: number;

  @IsNumber()
  @IsNotEmpty()
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