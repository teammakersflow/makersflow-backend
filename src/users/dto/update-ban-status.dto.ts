import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateBanStatusDto {
  @ApiProperty({
    example: true,
  })
  @IsBoolean()
  isBanned: boolean;
}