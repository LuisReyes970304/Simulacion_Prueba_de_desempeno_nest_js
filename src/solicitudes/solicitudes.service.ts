import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, ILike, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Solicitude } from './entities/solicitude.entity.js';
import { SolicitudHistorial } from './entities/solicitud-historial.entity.js';
import { CreateSolicitudeDto } from './dto/create-solicitude.dto.js';
import { UpdateEstadoDto } from './dto/update-estado.dto.js';
import { AssignSolicitudeDto } from './dto/assign-solicitude.dto.js';
import { FindSolicitudesQueryDto } from './dto/find-solicitudes-query.dto.js';
import { EstadoSolicitud } from './enums/estado-solicitud.enum.js';
import { TipoEventoHistorial } from './enums/tipo-evento-historial.enum.js';
import { findUserByUsername, User } from '../auth/users.js';

const ALLOWED_TRANSITIONS: Record<EstadoSolicitud, EstadoSolicitud | undefined> = {
  [EstadoSolicitud.PENDIENTE]: EstadoSolicitud.EN_GESTION,
  [EstadoSolicitud.EN_GESTION]: EstadoSolicitud.RESUELTA,
  [EstadoSolicitud.RESUELTA]: undefined,
};

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(Solicitude)
    private readonly solicitudesRepository: Repository<Solicitude>,
    @InjectRepository(SolicitudHistorial)
    private readonly historialRepository: Repository<SolicitudHistorial>,
  ) {}

  private recordHistorial(event: {
    solicitudId: number;
    tipoEvento: TipoEventoHistorial;
    valorAnterior: string | null;
    valorNuevo: string;
    usuarioActor: string;
  }) {
    return this.historialRepository.save(this.historialRepository.create(event));
  }

  async create(createSolicitudeDto: CreateSolicitudeDto, user: User) {
    const asesor = user.role === 'asesor' ? user.username : null;

    const solicitude = this.solicitudesRepository.create({
      cliente: createSolicitudeDto.cliente,
      descripcion: createSolicitudeDto.descripcion,
      asesor,
      estado: EstadoSolicitud.PENDIENTE,
    });

    const saved = await this.solicitudesRepository.save(solicitude);

    await this.recordHistorial({
      solicitudId: saved.id,
      tipoEvento: TipoEventoHistorial.CREACION,
      valorAnterior: null,
      valorNuevo: EstadoSolicitud.PENDIENTE,
      usuarioActor: user.username,
    });

    return saved;
  }

  async findAll(
    query: FindSolicitudesQueryDto,
    user: User,
  ): Promise<PaginatedResult<Solicitude>> {
    if (query.desde && query.hasta && new Date(query.desde) > new Date(query.hasta)) {
      throw new BadRequestException('"desde" must not be after "hasta"');
    }

    const where: Record<string, unknown> = {};

    if (user.role === 'asesor') {
      where.asesor = user.username;
    } else if (query.asesor) {
      where.asesor = query.asesor;
    }

    if (query.estado) {
      where.estado = query.estado;
    }

    if (query.cliente) {
      where.cliente = ILike(`%${query.cliente}%`);
    }

    if (query.desde && query.hasta) {
      where.creadaEn = Between(new Date(query.desde), new Date(query.hasta));
    } else if (query.desde) {
      where.creadaEn = MoreThanOrEqual(new Date(query.desde));
    } else if (query.hasta) {
      where.creadaEn = LessThanOrEqual(new Date(query.hasta));
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [items, total] = await this.solicitudesRepository.findAndCount({
      where,
      order: { creadaEn: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, user: User) {
    const where = user.role === 'asesor' ? { id, asesor: user.username } : { id };
    const solicitude = await this.solicitudesRepository.findOne({ where });

    if (!solicitude) {
      throw new NotFoundException(`Solicitude with id ${id} not found`);
    }

    return solicitude;
  }

  async updateEstado(id: number, updateEstadoDto: UpdateEstadoDto, user: User) {
    const solicitude = await this.findOne(id, user);

    const nextAllowed = ALLOWED_TRANSITIONS[solicitude.estado];
    if (nextAllowed !== updateEstadoDto.estado) {
      throw new ConflictException(
        `Invalid state transition from ${solicitude.estado} to ${updateEstadoDto.estado}. Allowed: ${solicitude.estado} -> ${nextAllowed ?? 'none'}`,
      );
    }

    const previousEstado = solicitude.estado;
    solicitude.estado = updateEstadoDto.estado;
    const saved = await this.solicitudesRepository.save(solicitude);

    await this.recordHistorial({
      solicitudId: saved.id,
      tipoEvento: TipoEventoHistorial.ESTADO,
      valorAnterior: previousEstado,
      valorNuevo: saved.estado,
      usuarioActor: user.username,
    });

    return saved;
  }

  async assign(id: number, assignDto: AssignSolicitudeDto, user: User) {
    const solicitude = await this.solicitudesRepository.findOne({ where: { id } });
    if (!solicitude) {
      throw new NotFoundException(`Solicitude with id ${id} not found`);
    }

    const asesorUser = findUserByUsername(assignDto.asesor);
    if (!asesorUser || asesorUser.role !== 'asesor') {
      throw new BadRequestException(`"${assignDto.asesor}" is not a valid asesor`);
    }

    if (solicitude.estado === EstadoSolicitud.RESUELTA) {
      throw new ConflictException('A resolved request cannot be reassigned');
    }

    const previousAsesor = solicitude.asesor;
    solicitude.asesor = asesorUser.username;
    const saved = await this.solicitudesRepository.save(solicitude);

    await this.recordHistorial({
      solicitudId: saved.id,
      tipoEvento: TipoEventoHistorial.ASIGNACION,
      valorAnterior: previousAsesor,
      valorNuevo: asesorUser.username,
      usuarioActor: user.username,
    });

    return saved;
  }

  async findHistorial(id: number, user: User) {
    const solicitude = await this.findOne(id, user);

    return this.historialRepository.find({
      where: { solicitudId: solicitude.id },
      order: { fechaEvento: 'ASC' },
    });
  }
}
