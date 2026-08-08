import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({
    nullable: true,
  })
  full_name: string;

  @ApiProperty()
  role: string;

  @ApiProperty({
    nullable: true,
  })
  avatar_url: string;

  @ApiProperty()
  created_at: Date;
}