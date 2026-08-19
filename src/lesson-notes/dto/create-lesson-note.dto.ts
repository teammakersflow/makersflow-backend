import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateLessonNoteDto {
  @IsNotEmpty()
  @IsInt()
  lesson_id!: number;

  @IsNotEmpty()
  @IsString()
  content!: string;

  @IsInt()
  position!: number;
}