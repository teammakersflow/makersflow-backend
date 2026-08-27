import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
    @Req() req: Request,
    @Body() createShippingAddressDto: CreateShippingAddressDto,
  ) {
    const user = req.user as any;

    return this.shippingAddressesService.create(
      user.id,
      createShippingAddressDto,
    );
  }

  @Get()
  findAll(@Req() req: Request) {
    const user = req.user as any;

    return this.shippingAddressesService.findAll(
      user.id,
    );
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateShippingAddressDto: UpdateShippingAddressDto,
  ) {
    const user = req.user as any;

    return this.shippingAddressesService.update(
      user.id,
      BigInt(id),
      updateShippingAddressDto,
    );
  }

  @Delete(':id')
  remove(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const user = req.user as any;

    return this.shippingAddressesService.remove(
      user.id,
      BigInt(id),
    );
  }
}