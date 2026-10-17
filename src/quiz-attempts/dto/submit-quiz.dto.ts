
import { IsObject, IsString, Matches } from 'class-validator';

export class SubmitQuizDto {
  @IsString()
  @Matches(/^\d+$/)
  lesson_id!: string;

  @IsObject()
  answers!: Record<string, number>;
}
