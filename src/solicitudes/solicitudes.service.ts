import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Solicitude } from './entities/solicitude.entity.js';
import { CreateSolicitudeDto } from './dto/create-solicitude.dto.js';
import { UpdateEstadoDto } from './dto/update-estado.dto.js';
import { EstadoSolicitud } from './enums/estado-solicitud.enum.js';
import { findUserByUsername, User } from '../auth/users.js';

const ALLOWED_TRANSITIONS: Record<EstadoSolicitud, EstadoSolicitud | undefined> = {
  [EstadoSolicitud.PENDIENTE]: EstadoSolicitud.EN_GESTION,
  [EstadoSolicitud.EN_GESTION]: EstadoSolicitud.RESUELTA,
  [EstadoSolicitud.RESUELTA]: undefined,
};

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(Solicitude)
    private readonly solicitudesRepository: Repository<Solicitude>,
  ) {}

  create(createSolicitudeDto: CreateSolicitudeDto, user: User) {
    let asesor: string;

    if (user.role === 'asesor') {
      asesor = user.username;
    } else {
      if (!createSolicitudeDto.asesor) {
        throw new BadRequestException('asesor is required when creating a request as admin or supervisor');
      }

      const asesorUser = findUserByUsername(createSolicitudeDto.asesor);
      if (!asesorUser || asesorUser.role !== 'asesor') {
        throw new BadRequestException(`"${createSolicitudeDto.asesor}" is not a valid asesor`);
      }

      asesor = asesorUser.username;
    }

    const solicitude = this.solicitudesRepository.create({
      cliente: createSolicitudeDto.cliente,
      descripcion: createSolicitudeDto.descripcion,
      asesor,
      estado: EstadoSolicitud.PENDIENTE,
    });

    return this.solicitudesRepository.save(solicitude);
  }

  findAll(user: User) {
    const where = user.role === 'asesor' ? { asesor: user.username } : {};
    return this.solicitudesRepository.find({ where, order: { creadaEn: 'DESC' } });
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

    solicitude.estado = updateEstadoDto.estado;
    return this.solicitudesRepository.save(solicitude);
  }
}
