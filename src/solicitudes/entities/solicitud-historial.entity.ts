import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Solicitude } from './solicitude.entity.js';
import { TipoEventoHistorial } from '../enums/tipo-evento-historial.enum.js';

@Entity('solicitudes_historial')
export class SolicitudHistorial {
  @ApiProperty({ description: 'History event id', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Id of the related request', example: 1 })
  @Index()
  @Column()
  solicitudId: number;

  @ManyToOne(() => Solicitude, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solicitudId' })
  solicitud: Solicitude;

  @ApiProperty({
    description: 'Type of event recorded',
    enum: TipoEventoHistorial,
    example: TipoEventoHistorial.ESTADO,
  })
  @Column({ type: 'enum', enum: TipoEventoHistorial })
  tipoEvento: TipoEventoHistorial;

  @ApiProperty({
    description: 'Value before the change, when applicable',
    example: 'PENDIENTE',
    nullable: true,
  })
  @Column({ type: 'varchar', nullable: true })
  valorAnterior: string | null;

  @ApiProperty({ description: 'New value applied', example: 'EN_GESTION' })
  @Column({ type: 'varchar' })
  valorNuevo: string;

  @ApiProperty({ description: 'Username of the user who performed the action', example: 'asesor1' })
  @Column()
  usuarioActor: string;

  @ApiProperty({ description: 'Timestamp of the event' })
  @CreateDateColumn()
  fechaEvento: Date;
}
