import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ChallengeRegistrationDto {
  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @IsInt()
  @Min(1)
  age!: number;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  institution!: string;

  @IsString()
  @IsNotEmpty()
  class_year!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  project_category!: string;

  @IsOptional()
  @IsString()
  motivation?: string;
}