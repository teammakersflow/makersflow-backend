import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';

import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { BulkUpdateOrdersDto } from './dto/bulk-update-orders.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orders')
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

@Get()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
findAll(@Query('include') include?: string) {
  const includeUser =
    include
      ?.split(',')
      .map((item) => item.trim())
      .includes('user') ?? false;

  return this.ordersService.findAll(includeUser);
}

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  bulkUpdate(@Body() bulkUpdateOrdersDto: BulkUpdateOrdersDto) {
    return this.ordersService.bulkUpdate(bulkUpdateOrdersDto);
}

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}