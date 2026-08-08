import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
} from 'class-validator';

export class CreateModuleDto {
  @IsNumber()
  course_id!: number;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  duration_mins?: number;

  @IsOptional()
  @IsInt()
  order_index?: number;

  @IsOptional()
  @IsInt()
  order?: number;
}