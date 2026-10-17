
import { IsIn } from 'class-validator';

export class UpdateReviewStatusDto {
  @IsIn(['pending', 'approved', 'rejected'])
  status!: 'pending' | 'approved' | 'rejected';
}
