import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Min, ValidateNested,
} from 'class-validator';

export class KitItemDto {
  @Matches(/^\d+$/, { message: 'product_id must be a numeric string' })
  product_id: string; // products.id is BigInt, so it's sent as a string

  @IsInt() @Min(1)
  quantity: number;
}

export class CreateKitDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => KitItemDto)
  items: KitItemDto[];
}

export class UpdateKitDto {
  @IsOptional() @IsString() @IsNotEmpty()
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsIn(['active', 'inactive'])
  status?: string;

  // If sent, it replaces the kit's whole product list
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => KitItemDto)
  items?: KitItemDto[];
}

export class SetCourseKitDto {
  @IsOptional() @IsUUID()
  kit_id?: string | null; // null or omitted removes the kit from the course
}
