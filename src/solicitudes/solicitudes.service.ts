import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Solicitude } from './entities/solicitude.entity.js';
import { CreateSolicitudeDto } from './dto/create-solicitude.dto.js';
import { UpdateEstadoDto } from './dto/update-estado.dto.js';
import { EstadoSolicitud } from './enums/estado-solicitud.enum.js';

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(Solicitude)
    private readonly solicitudesRepository: Repository<Solicitude>,
  ) {}

  create(createSolicitudeDto: CreateSolicitudeDto) {
    const solicitude = this.solicitudesRepository.create({
      ...createSolicitudeDto,
      estado: EstadoSolicitud.PENDIENTE,
    });
    return this.solicitudesRepository.save(solicitude);
  }

  findAll() {
    return this.solicitudesRepository.find({ order: { creadaEn: 'DESC' } });
  }

  async findOne(id: number) {
    const solicitude = await this.solicitudesRepository.findOne({ where: { id } });
    if (!solicitude) {
      throw new NotFoundException(`Solicitude with id ${id} not found`);
    }
    return solicitude;
  }

  async update(id: number, updateEstadoDto: UpdateEstadoDto) {
    const solicitude = await this.findOne(id);
    solicitude.estado = updateEstadoDto.estado;
    return this.solicitudesRepository.save(solicitude);
  }
}
