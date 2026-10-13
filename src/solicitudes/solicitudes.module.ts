import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudesService } from './solicitudes.service.js';
import { SolicitudesController } from './solicitudes.controller.js';
import { Solicitude } from './entities/solicitude.entity.js';
import { SolicitudHistorial } from './entities/solicitud-historial.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Solicitude, SolicitudHistorial])],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
})
export class SolicitudesModule {}
