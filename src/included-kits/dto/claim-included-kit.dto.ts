import { IsNotEmpty, IsString } from 'class-validator';

export class ClaimIncludedKitDto {
  @IsString()
  @IsNotEmpty()
  coursePurchaseId!: string;

  @IsString()
  @IsNotEmpty()
  shippingAddressId!: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
