import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SolicitudesService } from './solicitudes.service.js';
import { Solicitude } from './entities/solicitude.entity.js';
import { SolicitudHistorial } from './entities/solicitud-historial.entity.js';
import { EstadoSolicitud } from './enums/estado-solicitud.enum.js';
import { TipoEventoHistorial } from './enums/tipo-evento-historial.enum.js';
import { User } from '../auth/users.js';

type MockRepository = {
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  findAndCount: ReturnType<typeof vi.fn>;
};

const createMockRepository = (): MockRepository => ({
  create: vi.fn((entity) => entity),
  save: vi.fn(async (entity) => ({ id: 1, ...entity })),
  find: vi.fn(),
  findOne: vi.fn(),
  findAndCount: vi.fn(),
});

const asesor1: User = { username: 'asesor1', role: 'asesor' };
const asesor2: User = { username: 'asesor2', role: 'asesor' };
const admin1: User = { username: 'admin1', role: 'admin' };
const supervisor1: User = { username: 'supervisor1', role: 'supervisor' };

describe('SolicitudesService', () => {
  let service: SolicitudesService;
  let repository: MockRepository;
  let historialRepository: MockRepository;

  beforeEach(async () => {
    repository = createMockRepository();
    historialRepository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        { provide: getRepositoryToken(Solicitude), useValue: repository },
        { provide: getRepositoryToken(SolicitudHistorial), useValue: historialRepository },
      ],
    }).compile();

    service = module.get<SolicitudesService>(SolicitudesService);
  });

  describe('create', () => {
    it('forces estado to PENDIENTE regardless of input', async () => {
      const result = await service.create({ cliente: 'Acme', descripcion: 'desc' } as any, asesor1);
      expect(result.estado).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('forces asesor to the caller username when role is asesor', async () => {
      const result = await service.create({ cliente: 'Acme', descripcion: 'desc' } as any, asesor1);
      expect(result.asesor).toBe('asesor1');
    });

    it('leaves asesor unassigned (null) when created by admin or supervisor', async () => {
      const result = await service.create({ cliente: 'Acme', descripcion: 'desc' } as any, admin1);
      expect(result.asesor).toBeNull();
    });

    it('records a CREACION historial event with valorNuevo PENDIENTE', async () => {
      await service.create({ cliente: 'Acme', descripcion: 'desc' } as any, asesor1);
      expect(historialRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoEvento: TipoEventoHistorial.CREACION,
          valorAnterior: null,
          valorNuevo: EstadoSolicitud.PENDIENTE,
          usuarioActor: 'asesor1',
        }),
      );
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      repository.findAndCount.mockResolvedValue([[], 0]);
    });

    it('applies an asesor filter and default pagination for asesor role', async () => {
      await service.findAll({ page: 1, limit: 10 } as any, asesor1);
      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { asesor: 'asesor1' },
        order: { creadaEn: 'DESC' },
        skip: 0,
        take: 10,
      });
    });

    it('ignores an asesor query param for an asesor caller (cannot widen own scope)', async () => {
      await service.findAll({ page: 1, limit: 10, asesor: 'asesor2' } as any, asesor1);
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { asesor: 'asesor1' } }),
      );
    });

    it('applies an asesor query filter for admin/supervisor', async () => {
      await service.findAll({ page: 1, limit: 10, asesor: 'asesor2' } as any, admin1);
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { asesor: 'asesor2' } }),
      );
    });

    it('does not filter by asesor for admin/supervisor when none is given', async () => {
      await service.findAll({ page: 1, limit: 10 } as any, admin1);
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('computes pagination metadata from total and limit', async () => {
      repository.findAndCount.mockResolvedValue([[{ id: 1 }], 25]);
      const result = await service.findAll({ page: 2, limit: 10 } as any, admin1);
      expect(result.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('rejects a desde later than hasta', async () => {
      await expect(
        service.findAll(
          { page: 1, limit: 10, desde: '2026-02-01', hasta: '2026-01-01' } as any,
          admin1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('scopes the lookup by asesor username for asesor role', async () => {
      repository.findOne.mockResolvedValue({ id: 1, asesor: 'asesor1' });
      await service.findOne(1, asesor1);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1, asesor: 'asesor1' },
      });
    });

    it('throws NotFoundException when the record does not exist or is not owned', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.findOne(1, asesor2)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateEstado', () => {
    it('allows PENDIENTE -> EN_GESTION', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        asesor: 'asesor1',
        estado: EstadoSolicitud.PENDIENTE,
      });

      const result = await service.updateEstado(
        1,
        { estado: EstadoSolicitud.EN_GESTION },
        asesor1,
      );
      expect(result.estado).toBe(EstadoSolicitud.EN_GESTION);
    });

    it('records an ESTADO historial event on a valid transition', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        asesor: 'asesor1',
        estado: EstadoSolicitud.PENDIENTE,
      });

      await service.updateEstado(1, { estado: EstadoSolicitud.EN_GESTION }, asesor1);
      expect(historialRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoEvento: TipoEventoHistorial.ESTADO,
          valorAnterior: EstadoSolicitud.PENDIENTE,
          valorNuevo: EstadoSolicitud.EN_GESTION,
          usuarioActor: 'asesor1',
        }),
      );
    });

    it('rejects PENDIENTE -> RESUELTA with 409', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        asesor: 'asesor1',
        estado: EstadoSolicitud.PENDIENTE,
      });

      await expect(
        service.updateEstado(1, { estado: EstadoSolicitud.RESUELTA }, asesor1),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects reopening a RESUELTA request with 409', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        asesor: 'asesor1',
        estado: EstadoSolicitud.RESUELTA,
      });

      await expect(
        service.updateEstado(1, { estado: EstadoSolicitud.EN_GESTION }, asesor1),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws NotFoundException when the request is not owned by the asesor', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.updateEstado(1, { estado: EstadoSolicitud.EN_GESTION }, asesor2),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assign', () => {
    it('assigns an unassigned request to a valid asesor', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        asesor: null,
        estado: EstadoSolicitud.PENDIENTE,
      });

      const result = await service.assign(1, { asesor: 'asesor2' }, admin1);
      expect(result.asesor).toBe('asesor2');
    });

    it('does not change estado when reassigning', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        asesor: 'asesor1',
        estado: EstadoSolicitud.EN_GESTION,
      });

      const result = await service.assign(1, { asesor: 'asesor2' }, supervisor1);
      expect(result.estado).toBe(EstadoSolicitud.EN_GESTION);
    });

    it('records an ASIGNACION historial event with the previous and new asesor', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        asesor: 'asesor1',
        estado: EstadoSolicitud.PENDIENTE,
      });

      await service.assign(1, { asesor: 'asesor2' }, admin1);
      expect(historialRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoEvento: TipoEventoHistorial.ASIGNACION,
          valorAnterior: 'asesor1',
          valorNuevo: 'asesor2',
          usuarioActor: 'admin1',
        }),
      );
    });

    it('rejects assigning to a non-existent user', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        asesor: null,
        estado: EstadoSolicitud.PENDIENTE,
      });

      await expect(service.assign(1, { asesor: 'ghost' }, admin1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects assigning to a user without the asesor role', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        asesor: null,
        estado: EstadoSolicitud.PENDIENTE,
      });

      await expect(service.assign(1, { asesor: 'admin1' }, supervisor1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects reassigning a RESUELTA request with 409', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        asesor: 'asesor1',
        estado: EstadoSolicitud.RESUELTA,
      });

      await expect(service.assign(1, { asesor: 'asesor2' }, admin1)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws NotFoundException when the request does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.assign(1, { asesor: 'asesor2' }, admin1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findHistorial', () => {
    it('returns the history for a request owned by the asesor', async () => {
      repository.findOne.mockResolvedValue({ id: 1, asesor: 'asesor1' });
      historialRepository.find.mockResolvedValue([{ id: 1 }]);

      const result = await service.findHistorial(1, asesor1);
      expect(result).toEqual([{ id: 1 }]);
      expect(historialRepository.find).toHaveBeenCalledWith({
        where: { solicitudId: 1 },
        order: { fechaEvento: 'ASC' },
      });
    });

    it('throws NotFoundException when the asesor does not currently own the request', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findHistorial(1, asesor2)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows admin/supervisor to view the history of any request', async () => {
      repository.findOne.mockResolvedValue({ id: 1, asesor: 'asesor1' });
      historialRepository.find.mockResolvedValue([]);

      await service.findHistorial(1, admin1);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
