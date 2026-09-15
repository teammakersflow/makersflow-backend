import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class ChallengeSubmissionDto {
  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @IsInt()
  @Min(1)
  age!: number;

  @IsString()
  @IsNotEmpty()
  institution!: string;

  @IsString()
  @IsNotEmpty()
  kit_name!: string;

  @IsString()
  @IsNotEmpty()
  project_title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  problem_solved!: string;

  @IsOptional()
  @IsString()
  inspiration?: string;

  @IsOptional()
  @IsUrl()
  video_url?: string;

  @IsOptional()
  @IsArray()
  image_urls?: string[];

  @IsOptional()
  @IsBoolean()
  feature_consent?: boolean;
}