import { IsArray, IsString } from 'class-validator';

export class BulkDeletePromoCodesDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}