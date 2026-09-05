import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

import { ShippingAddressesService } from './shipping-addresses.service';
import { CreateShippingAddressDto } from './dto/create-shipping-address.dto';
import { UpdateShippingAddressDto } from './dto/update-shipping-address.dto';

@Controller('shipping-addresses')
@UseGuards(JwtAuthGuard)
export class ShippingAddressesController {
  constructor(
    private readonly shippingAddressesService: ShippingAddressesService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createShippingAddressDto: CreateShippingAddressDto,
  ) {
    return this.shippingAddressesService.create(
      user.id,
      createShippingAddressDto,
    );
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.shippingAddressesService.findAll(user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateShippingAddressDto: UpdateShippingAddressDto,
  ) {
    return this.shippingAddressesService.update(
      user.id,
      BigInt(id),
      updateShippingAddressDto,
    );
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.shippingAddressesService.remove(
      user.id,
      BigInt(id),
    );
  }
}