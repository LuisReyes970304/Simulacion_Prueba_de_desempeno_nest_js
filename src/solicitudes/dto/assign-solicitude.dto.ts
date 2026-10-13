import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignSolicitudeDto {
  @ApiProperty({
    description:
      'Username of the asesor to assign/reassign the request to. Must be an existing user with the "asesor" role.',
    example: 'asesor2',
  })
  @IsString()
  @IsNotEmpty({ message: 'asesor must not be empty' })
  asesor: string;
}
