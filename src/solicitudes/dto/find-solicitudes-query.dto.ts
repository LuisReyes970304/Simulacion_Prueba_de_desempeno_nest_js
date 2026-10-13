import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { EstadoSolicitud } from '../enums/estado-solicitud.enum.js';

export class FindSolicitudesQueryDto {
  @ApiPropertyOptional({ enum: EstadoSolicitud, description: 'Filter by state' })
  @IsOptional()
  @IsEnum(EstadoSolicitud, {
    message: `estado must be one of: ${Object.values(EstadoSolicitud).join(', ')}`,
  })
  estado?: EstadoSolicitud;

  @ApiPropertyOptional({
    description:
      'Filter by assigned asesor username. Ignored for a caller with the "asesor" role, who always sees only their own requests.',
    example: 'asesor1',
  })
  @IsOptional()
  @IsString()
  asesor?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive partial match on cliente',
    example: 'acme',
  })
  @IsOptional()
  @IsString()
  cliente?: string;

  @ApiPropertyOptional({
    description: 'Start of the creadaEn date range (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'desde must be a valid ISO 8601 date' })
  desde?: string;

  @ApiPropertyOptional({
    description: 'End of the creadaEn date range (ISO 8601)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'hasta must be a valid ISO 8601 date' })
  hasta?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be greater than or equal to 1' })
  page: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (max 100)', default: 10, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be greater than or equal to 1' })
  @Max(100, { message: 'limit must not exceed 100' })
  limit: number = 10;
}
