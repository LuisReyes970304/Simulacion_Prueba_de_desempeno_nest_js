import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoSolicitud } from '../enums/estado-solicitud.enum.js';

export class UpdateEstadoDto {
  @ApiProperty({
    description: 'Nuevo estado de la solicitud',
    enum: EstadoSolicitud,
    example: EstadoSolicitud.EN_GESTION,
  })
  @IsEnum(EstadoSolicitud, {
    message: `estado must be one of: ${Object.values(EstadoSolicitud).join(', ')}`,
  })
  estado: EstadoSolicitud;
}
