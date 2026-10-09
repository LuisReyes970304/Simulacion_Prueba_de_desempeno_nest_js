import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSolicitudeDto {
  @ApiProperty({
    description: 'Nombre del cliente que realiza la solicitud',
    example: 'Juan Pérez',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'cliente must not be empty' })
  cliente: string;

  @ApiProperty({
    description: 'Descripción de la solicitud',
    example: 'El cliente solicita una llamada de seguimiento',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'descripcion must not be empty' })
  descripcion: string;

  @ApiPropertyOptional({
    description:
      'Nombre de usuario del asesor al que se asigna la solicitud. Obligatorio (y debe pertenecer a un usuario existente con rol "asesor") cuando la crea un admin o supervisor. Se ignora y se sobrescribe en el servidor cuando la crea un asesor.',
    example: 'asesor1',
  })
  @IsOptional()
  @IsString()
  asesor?: string;
}
