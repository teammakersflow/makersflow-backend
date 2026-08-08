import { IsNumber, IsUUID, IsString } from 'class-validator';

export class CreateCertificateDto {
  @IsUUID()
  user_id!: string;

  @IsNumber()
  course_id!: number;

  @IsString()
  certificate_number!: string;
}