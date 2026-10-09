import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe } from '@nestjs/common';
import { SolicitudesService } from './solicitudes.service.js';
import { CreateSolicitudeDto } from './dto/create-solicitude.dto.js';
import { UpdateEstadoDto } from './dto/update-estado.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { User } from '../auth/users.js';

@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  @Roles('admin', 'supervisor', 'asesor')
  create(@Body() createSolicitudeDto: CreateSolicitudeDto, @CurrentUser() user: User) {
    return this.solicitudesService.create(createSolicitudeDto, user);
  }

  @Get()
  @Roles('admin', 'supervisor', 'asesor')
  findAll(@CurrentUser() user: User) {
    return this.solicitudesService.findAll(user);
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'asesor')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.solicitudesService.findOne(id, user);
  }

  @Patch(':id/estado')
  @Roles('admin', 'supervisor', 'asesor')
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEstadoDto: UpdateEstadoDto,
    @CurrentUser() user: User,
  ) {
    return this.solicitudesService.updateEstado(id, updateEstadoDto, user);
  }
}
