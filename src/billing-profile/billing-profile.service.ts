import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateBillingProfileDto } from './dto/update-billing-profile.dto';

@Injectable()
export class BillingProfileService {
  constructor(private prisma: PrismaService) {}

  async getMyBillingProfile(userId: string) {
    const billingProfile =
      await this.prisma.shipping_addresses.findFirst({
        where: {
          user_id: userId,
          is_default: true,
        },
      });

    if (!billingProfile) {
      throw new NotFoundException(
        'Default billing address not found',
      );
    }

    return {
      id: billingProfile.id.toString(),
      full_name: billingProfile.full_name,
      phone: billingProfile.phone,
      address_line1: billingProfile.address_line1,
      address_line2: billingProfile.address_line2,
      city: billingProfile.city,
      state: billingProfile.state,
      pincode: billingProfile.postal_code,
    };
  }

  async updateMyBillingProfile(
    userId: string,
    updateBillingProfileDto: UpdateBillingProfileDto,
  ) {
    const billingProfile =
      await this.prisma.shipping_addresses.findFirst({
        where: {
          user_id: userId,
          is_default: true,
        },
      });

    if (!billingProfile) {
      throw new NotFoundException(
        'Default billing address not found',
      );
    }

    const {
      pincode,
      ...rest
    } = updateBillingProfileDto;

    const updated =
      await this.prisma.shipping_addresses.update({
        where: {
          id: billingProfile.id,
        },
        data: {
          ...rest,
          ...(pincode !== undefined && {
            postal_code: pincode,
          }),
        },
      });

    return {
      id: updated.id.toString(),
      full_name: updated.full_name,
      phone: updated.phone,
      address_line1: updated.address_line1,
      address_line2: updated.address_line2,
      city: updated.city,
      state: updated.state,
      pincode: updated.postal_code,
    };
  }
}