import { ApiProperty } from '@nestjs/swagger';

export class CreateSolicitudeDto {

    @ApiProperty({ description: 'Nombre del solicitante' })
    cliente: string;

    @ApiProperty({ description: 'Descripción de la solicitud' })
    descripcion: string;

    @ApiProperty({ description: 'Asesor asignado' })
    asesor: string;

    @ApiProperty({ description: 'Estado de la solicitud', enum: ['pendiente', 'en_gestion', 'resuelta'], default: 'pendiente' })
    estado: 'pendiente' | 'en_gestion' | 'resuelta';
}

