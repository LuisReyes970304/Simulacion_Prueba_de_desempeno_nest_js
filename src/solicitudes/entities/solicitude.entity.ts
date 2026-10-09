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
  @ApiProperty({ description: 'Id de la solicitud', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Nombre del cliente que realiza la solicitud', example: 'Juan Pérez' })
  @Column()
  cliente: string;

  @ApiProperty({
    description: 'Descripción de la solicitud',
    example: 'El cliente solicita una llamada de seguimiento',
  })
  @Column()
  descripcion: string;

  @ApiProperty({ description: 'Nombre de usuario del asesor asignado', example: 'asesor1' })
  @Index()
  @Column()
  asesor: string;

  @ApiProperty({
    description: 'Estado actual de la solicitud',
    enum: EstadoSolicitud,
    example: EstadoSolicitud.PENDIENTE,
  })
  @Column({
    type: 'enum',
    enum: EstadoSolicitud,
    default: EstadoSolicitud.PENDIENTE,
  })
  estado: EstadoSolicitud;

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn()
  creadaEn: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  @UpdateDateColumn()
  actualizadaEn: Date;
}
