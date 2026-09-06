import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateFeedbackDto {
  @IsInt()
  rating!: number;

  @IsOptional()
  @IsString()
  message?: string;
}