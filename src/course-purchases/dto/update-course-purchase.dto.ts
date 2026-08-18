import { PartialType } from '@nestjs/mapped-types';
import { CreateCoursePurchaseDto } from './create-course-purchase.dto';

export class UpdateCoursePurchaseDto extends PartialType(
  CreateCoursePurchaseDto,
) {}