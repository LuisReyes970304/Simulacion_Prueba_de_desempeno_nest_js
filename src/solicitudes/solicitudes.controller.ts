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
import { USERS } from '../auth/users.js';
import type { User } from '../auth/users.js';

const USERNAMES = USERS.map((user) => user.username);
const DEFAULT_USERNAME = USERNAMES[0];

const X_USER_DESCRIPTION =
  'Nombre de usuario que identifica al solicitante. Debe ser uno de los usuarios de prueba: ' +
  `${USERS.map((user) => `${user.username} (${user.role})`).join(', ')}. ` +
  'El rol asociado a la solicitud siempre se resuelve en el servidor a partir de este usuario, nunca a partir de lo enviado por el cliente.';

@ApiTags('Solicitudes')
@ApiSecurity('x-api-key')
@ApiHeader({
  name: 'x-user',
  required: true,
  description: X_USER_DESCRIPTION,
  schema: { type: 'string', enum: USERNAMES, default: DEFAULT_USERNAME },
})
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Crear una solicitud',
    description:
      'Crea una nueva solicitud. El estado siempre se fuerza a PENDIENTE. ' +
      'Si el solicitante es un asesor, el asesor se fuerza al usuario que hace la llamada. ' +
      'Si el solicitante es admin/supervisor, el asesor es obligatorio en el cuerpo y debe ser un usuario existente con rol asesor.',
  })
  @ApiBody({ type: CreateSolicitudeDto })
  @ApiResponse({ status: 201, description: 'Solicitud creada', type: Solicitude })
  @ApiResponse({ status: 400, description: 'Validación fallida o asesor ausente/inválido' })
  @ApiResponse({ status: 401, description: 'API key ausente/inválida o usuario desconocido' })
  @ApiResponse({ status: 403, description: 'Rol no permitido' })
  create(@Body() createSolicitudeDto: CreateSolicitudeDto, @CurrentUser() user: User) {
    return this.solicitudesService.create(createSolicitudeDto, user);
  }

  @Get()
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Listar solicitudes permitidas para el usuario',
    description:
      'Admin/supervisor ven todas las solicitudes. Un asesor solo ve las solicitudes asignadas a él, filtradas directamente en la consulta a la base de datos. Los resultados se ordenan por creadaEn descendente.',
  })
  @ApiResponse({ status: 200, description: 'Listado de solicitudes', type: [Solicitude] })
  @ApiResponse({ status: 401, description: 'API key ausente/inválida o usuario desconocido' })
  @ApiResponse({ status: 403, description: 'Rol no permitido' })
  findAll(@CurrentUser() user: User) {
    return this.solicitudesService.findAll(user);
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Consultar una solicitud por id',
    description:
      'Un asesor solo puede consultar las solicitudes asignadas a él; cualquier otro id de solicitud devuelve 404 (el mismo estado usado para un id inexistente) para que un asesor no pueda inferir que la solicitud de otro asesor existe.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Id de la solicitud' })
  @ApiResponse({ status: 200, description: 'Solicitud encontrada', type: Solicitude })
  @ApiResponse({ status: 400, description: 'El id no es numérico' })
  @ApiResponse({ status: 401, description: 'API key ausente/inválida o usuario desconocido' })
  @ApiResponse({ status: 403, description: 'Rol no permitido' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada o no pertenece al solicitante' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.solicitudesService.findOne(id, user);
  }

  @Patch(':id/estado')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Cambiar el estado de una solicitud',
    description:
      'Transiciones permitidas: PENDIENTE -> EN_GESTION y EN_GESTION -> RESUELTA únicamente. Cualquier otra transición (incluyendo no-ops o reabrir una solicitud RESUELTA) devuelve 409.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Id de la solicitud' })
  @ApiBody({ type: UpdateEstadoDto })
  @ApiResponse({ status: 200, description: 'Estado actualizado', type: Solicitude })
  @ApiResponse({ status: 400, description: 'Validación fallida (valor de estado inválido)' })
  @ApiResponse({ status: 401, description: 'API key ausente/inválida o usuario desconocido' })
  @ApiResponse({ status: 403, description: 'Rol no permitido' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada o no pertenece al solicitante' })
  @ApiResponse({ status: 409, description: 'Transición de estado inválida' })
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEstadoDto: UpdateEstadoDto,
    @CurrentUser() user: User,
  ) {
    return this.solicitudesService.updateEstado(id, updateEstadoDto, user);
  }
}
