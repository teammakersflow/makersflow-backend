import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({
    example: 'admin',
    description: 'Role of the user',
  })
  @IsString()
  @IsIn(['admin', 'student'])
  role: string;
}