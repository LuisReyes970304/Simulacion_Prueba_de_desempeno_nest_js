import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { EstadoSolicitud } from '../enums/estado-solicitud.enum.js';

@Entity('solicitudes')
export class Solicitude {
  @ApiProperty({ description: 'Request id', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Name of the client making the request', example: 'Jane Doe' })
  @Column()
  cliente: string;

  @ApiProperty({
    description: 'Description of the request',
    example: 'Customer cannot access their account dashboard',
  })
  @Column()
  descripcion: string;

  @ApiProperty({ description: 'Username of the assigned asesor', example: 'asesor1' })
  @Index()
  @Column()
  asesor: string;

  @ApiProperty({
    description: 'Current state of the request',
    enum: EstadoSolicitud,
    example: EstadoSolicitud.PENDIENTE,
  })
  @Column({
    type: 'enum',
    enum: EstadoSolicitud,
    default: EstadoSolicitud.PENDIENTE,
  })
  estado: EstadoSolicitud;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  creadaEn: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  actualizadaEn: Date;
}
