import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
} from 'class-validator';

export class CreateCoursePurchaseDto {
  @IsUUID()
  user_id!: string;

  @IsInt()
  course_id!: number;

  @IsOptional()
  @IsUUID()
  payment_id?: string;

  @IsOptional()
  @IsUUID()
  order_id?: string;

  @IsNumber()
  amount_paid!: number;

  @IsOptional()
  @IsBoolean()
  access_granted?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}