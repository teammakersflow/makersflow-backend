import {
  IsNumber,
  IsString,
  IsOptional,
  IsInt,
} from 'class-validator';

export class CreateReviewDto {
  @IsNumber()
  course_id!: number;

  @IsInt()
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}