import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ChallengeRegistrationDto {
  @IsString()
  full_name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;

  @IsEmail()
  email!: string;

  @IsString()
  phone!: string;

  @IsString()
  institution!: string;

  @IsOptional()
  @IsString()
  class_year?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  project_category?: string;

  @IsOptional()
  @IsString()
  motivation?: string;
}