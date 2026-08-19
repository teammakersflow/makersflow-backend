import { IsNumber } from 'class-validator';

export class CreateRefundDto {
  @IsNumber()
  amount!: number;
}