
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'student@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
