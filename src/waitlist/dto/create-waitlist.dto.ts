import { IsEmail } from 'class-validator';

export class CreateWaitlistDto {
  @IsEmail()
  email!: string;
}