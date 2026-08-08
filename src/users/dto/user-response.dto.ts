import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    example: 'ae4f88c9-cb2b-4478-ae93-414b3ce856...',
  })
  id: string;

  @ApiProperty({
    example: 'john@example.com',
  })
  email: string;

  @ApiProperty({
    example: 'John Doe',
    nullable: true,
  })
  full_name: string;

  @ApiProperty({
    example: 'student',
  })
  role: string;

  @ApiProperty({
    example: 'https://example.com/avatar.png',
    nullable: true,
  })
  avatar_url: string;

  @ApiProperty({
    example: '2026-07-20T10:35:49.220Z',
  })
  created_at: Date;
}