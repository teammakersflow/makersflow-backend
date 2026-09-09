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
    const token =
      this.configService.get<string>(
        'SHIPROCKET_API_TOKEN',
      );

    if (!token) {
      throw new InternalServerErrorException(
        'Shiprocket API token is missing',
      );
    }

    try {
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
    } catch (error: any) {
          console.error(
            '[SHIPROCKET] Status:',
            error.response?.status,
          );

          console.error(
            '[SHIPROCKET] Response:',
            error.response?.data,
          );

          console.error(
            '[SHIPROCKET] Message:',
            error.message,
          );

          throw new InternalServerErrorException(
            'Unable to fetch shipping rates',
          );
        }

      throw new InternalServerErrorException(
        'Unable to fetch shipping rates',
      );
    }
}