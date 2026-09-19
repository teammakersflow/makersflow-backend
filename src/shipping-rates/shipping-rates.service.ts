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
      this.configService.get<string>(
        'SHIPROCKET_PASSWORD',
      );

    if (!email || !password) {
      throw new InternalServerErrorException(
        'Shiprocket configuration is missing',
      );
    }

    try {
      // 1. Generate a fresh Shiprocket API token
      const loginResponse = await axios.post(
        'https://apiv2.shiprocket.in/v1/external/auth/login',
        {
          email,
          password,
        },
      );

      const token = loginResponse.data.token;

      if (!token) {
        throw new Error(
          'Shiprocket authentication did not return a token',
        );
      }

      // 2. Get available courier/rate options
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
  }

  async getShippingAmount(dto: ShippingRateDto): Promise<number> {
    const result = await this.getRates(dto);

    const couriers =
      result.data?.data?.available_courier_companies ?? [];

    if (!Array.isArray(couriers) || couriers.length === 0) {
      throw new InternalServerErrorException(
        'No shipping courier is available for this address',
      );
    }

    const validRates = couriers
      .map((courier: any) => Number(courier.rate))
      .filter((rate: number) => Number.isFinite(rate) && rate >= 0);

    if (validRates.length === 0) {
      throw new InternalServerErrorException(
        'Shiprocket returned no valid shipping rates',
      );
    }

    return Math.min(...validRates);
  }
}