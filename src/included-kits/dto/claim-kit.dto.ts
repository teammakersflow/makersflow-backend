import { IsObject } from 'class-validator';

export class ClaimKitDto {
  @IsObject()
  shipping_address: Record<string, any>;
}
