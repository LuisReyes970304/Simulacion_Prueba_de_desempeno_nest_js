import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { SolicitudesService } from './solicitudes.service.js';
import { CreateSolicitudeDto } from './dto/create-solicitude.dto.js';
import { UpdateEstadoDto } from './dto/update-estado.dto.js';
import { Solicitude } from './entities/solicitude.entity.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { User } from '../auth/users.js';

const X_USER_DESCRIPTION =
  'Username identifying the caller. Must be one of the in-memory test users: ' +
  'admin1 (admin), supervisor1 (supervisor), asesor1 (asesor), asesor2 (asesor). ' +
  'The role attached to the request is always resolved server-side from this username, never from client input.';

@ApiTags('Solicitudes')
@ApiSecurity('x-api-key')
@ApiSecurity('x-user')
@ApiHeader({ name: 'x-user', description: X_USER_DESCRIPTION, required: true })
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Create a request',
    description:
      'Creates a new solicitude. estado is always forced to PENDIENTE. ' +
      'If the caller is an asesor, asesor is forced to the caller username. ' +
      'If the caller is admin/supervisor, asesor is required in the body and must be an existing user with role asesor.',
  })
  @ApiBody({ type: CreateSolicitudeDto })
  @ApiResponse({ status: 201, description: 'Request created', type: Solicitude })
  @ApiResponse({ status: 400, description: 'Validation failed or asesor is missing/invalid' })
  @ApiResponse({ status: 401, description: 'Missing/invalid API key or unknown user' })
  @ApiResponse({ status: 403, description: 'Role not allowed' })
  create(@Body() createSolicitudeDto: CreateSolicitudeDto, @CurrentUser() user: User) {
    return this.solicitudesService.create(createSolicitudeDto, user);
  }

  @Get()
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'List requests',
    description:
      'Admin/supervisor see every request. An asesor only sees requests assigned to them, filtered directly in the database query. Results are ordered by creadaEn descending.',
  })
  @ApiResponse({ status: 200, description: 'List of requests', type: [Solicitude] })
  @ApiResponse({ status: 401, description: 'Missing/invalid API key or unknown user' })
  @ApiResponse({ status: 403, description: 'Role not allowed' })
  findAll(@CurrentUser() user: User) {
    return this.solicitudesService.findAll(user);
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Get a request by id',
    description:
      'An asesor can only fetch requests assigned to them; any other request id returns 404 (the same status used for a non-existent id) so an asesor cannot infer that another advisor\'s request exists.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Request found', type: Solicitude })
  @ApiResponse({ status: 400, description: 'id is not a number' })
  @ApiResponse({ status: 401, description: 'Missing/invalid API key or unknown user' })
  @ApiResponse({ status: 403, description: 'Role not allowed' })
  @ApiResponse({ status: 404, description: 'Request not found or not owned by the caller' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.solicitudesService.findOne(id, user);
  }

  @Patch(':id/estado')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Change the state of a request',
    description:
      'Allowed transitions: PENDIENTE -> EN_GESTION and EN_GESTION -> RESUELTA only. Any other transition (including no-ops or reopening a RESUELTA request) returns 409.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateEstadoDto })
  @ApiResponse({ status: 200, description: 'State updated', type: Solicitude })
  @ApiResponse({ status: 400, description: 'Validation failed (invalid estado value)' })
  @ApiResponse({ status: 401, description: 'Missing/invalid API key or unknown user' })
  @ApiResponse({ status: 403, description: 'Role not allowed' })
  @ApiResponse({ status: 404, description: 'Request not found or not owned by the caller' })
  @ApiResponse({ status: 409, description: 'Invalid state transition' })
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEstadoDto: UpdateEstadoDto,
    @CurrentUser() user: User,
  ) {
    return this.solicitudesService.updateEstado(id, updateEstadoDto, user);
  }
}
