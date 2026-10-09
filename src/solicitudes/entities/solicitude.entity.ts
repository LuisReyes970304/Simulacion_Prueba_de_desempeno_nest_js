import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

enum EstadoDeSolicitud {
    PENDIENTE = 'pendiente',
    EN_GESTION = 'en_gestion',
    RESUELTA = 'resuelta',
}

@Entity()
export class Solicitude {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    cliente: string;

    @Column()
    descripcion: string;

    @Column()
    asesor: string;

    @Column({ type: 'enum', 
        enum: EstadoDeSolicitud,
        default: EstadoDeSolicitud.PENDIENTE })
    estado: EstadoDeSolicitud;

    @Column({ type: 'timestamp', 
        default: () => 'CURRENT_TIMESTAMP' })
    creadaEn: Date;
}

