import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ChallengeSubmissionDto {
  @IsString()
  full_name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  kit_name?: string;

  @IsString()
  project_title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  problem_solved?: string;

  @IsOptional()
  @IsString()
  inspiration?: string;

  @IsOptional()
  @IsString()
  video_url?: string;

  @IsArray()
  @IsString({ each: true })
  image_urls!: string[];

  @IsBoolean()
  @IsOptional()
  feature_consent?: boolean;
}