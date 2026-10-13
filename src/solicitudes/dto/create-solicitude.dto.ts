import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

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
}
