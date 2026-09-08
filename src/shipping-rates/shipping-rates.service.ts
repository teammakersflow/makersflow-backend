import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { ShippingRateDto } from './dto/shipping-rate.dto';

@Injectable()
export class ShippingRatesService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async getRates(dto: ShippingRateDto) {
    const email =
      this.configService.get<string>('SHIPROCKET_EMAIL');

    const password =
      this.configService.get<string>('SHIPROCKET_PASSWORD');

    if (!email || !password) {
      throw new InternalServerErrorException(
        'Shiprocket configuration is missing',
      );
    }

    try {
      // Login to Shiprocket
      const loginResponse = await axios.post(
        'https://apiv2.shiprocket.in/v1/external/auth/login',
        {
          email,
          password,
        },
      );

      const token = loginResponse.data.token;

      // Get available courier/rate options
      const response = await axios.get(
        'https://apiv2.shiprocket.in/v1/external/courier/serviceability/',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            pickup_postcode: dto.pickup_postcode,
            delivery_postcode: dto.delivery_postcode,
            weight: dto.weight,
            cod: 0,
          },
        },
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(
        '[SHIPROCKET] Failed to fetch shipping rates:',
        error,
      );

      throw new InternalServerErrorException(
        'Unable to fetch shipping rates',
      );
    }
  }
}