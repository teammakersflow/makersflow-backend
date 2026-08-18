import { IsArray, IsObject, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateOrderDto } from './update-order.dto';

export class BulkUpdateOrdersDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsObject()
  @ValidateNested()
  @Type(() => UpdateOrderDto)
  data!: UpdateOrderDto;
}