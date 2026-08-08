import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsInt,
} from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  user_id!: string;

  @IsNumber()
  course_id!: number;

  @IsInt()
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  approved_comment?: string;
}