import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { Prisma } from '@prisma/client';

export class CreateQuizQuestionDto {
  @IsInt()
  lesson_id!: number;

  @IsString()
  question_text!: string;

  @IsArray()
  options!: Prisma.InputJsonValue;

  @IsOptional()
  @IsInt()
  correct_option_index?: number;

  @IsOptional()
  @IsInt()
  position?: number;
}