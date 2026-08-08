import { IsIn } from 'class-validator';

export class UpdateRoleDto {
  @IsIn(['student', 'instructor', 'admin'])
  role: 'student' | 'instructor' | 'admin';
}