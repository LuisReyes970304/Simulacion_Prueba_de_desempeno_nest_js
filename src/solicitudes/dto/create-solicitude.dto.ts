import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSolicitudeDto {
  @ApiProperty({
    description: 'Name of the client making the request',
    example: 'Luis Reyes',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'cliente must not be empty' })
  cliente: string;

  @ApiProperty({
    description: 'Description of the request',
    example: 'Customer requests a follow-up call',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'descripcion must not be empty' })
  descripcion: string;

  @ApiPropertyOptional({
    description:
      'Username of the advisor to assign the request to. Required (and must belong to an existing user with the "asesor" role) when created by an admin or supervisor. Ignored and overridden by the server when created by an asesor.',
    example: 'asesor1',
  })
  @IsOptional()
  @IsString()
  asesor?: string;
}
