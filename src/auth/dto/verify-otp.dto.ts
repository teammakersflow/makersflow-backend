import { IsMobilePhone, IsNotEmpty, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsMobilePhone('en-IN')
  phoneNumber: string;

  @IsNotEmpty()
  @Length(6, 6)
  otp: string;
}