import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';


export class CreateQuizQuestionDto {
  @IsInt()
  lesson_id!: number;

  @IsString()
  question_text!: string;

  @IsArray()
  @IsString({ each: true })
  options!: string[];

  @IsOptional()
  @IsInt()
  correct_option_index?: number;

  @IsOptional()
  @IsInt()
  position?: number;
}