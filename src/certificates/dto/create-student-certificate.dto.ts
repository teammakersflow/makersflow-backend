import { IsNumber } from 'class-validator';

export class CreateStudentCertificateDto {
  @IsNumber()
  course_id!: number;
}