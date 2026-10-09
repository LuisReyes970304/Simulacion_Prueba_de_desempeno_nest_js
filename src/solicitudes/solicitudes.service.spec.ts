import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SolicitudesService } from './solicitudes.service.js';
import { Solicitude } from './entities/solicitude.entity.js';
import { EstadoSolicitud } from './enums/estado-solicitud.enum.js';
import { User } from '../auth/users.js';

type MockRepository = {
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
};

const createMockRepository = (): MockRepository => ({
  create: vi.fn((entity) => entity),
  save: vi.fn(async (entity) => ({ id: 1, ...entity })),
  find: vi.fn(),
  findOne: vi.fn(),
});

const asesor1: User = { username: 'asesor1', role: 'asesor' };
const asesor2: User = { username: 'asesor2', role: 'asesor' };
const admin1: User = { username: 'admin1', role: 'admin' };
const supervisor1: User = { username: 'supervisor1', role: 'supervisor' };

describe('SolicitudesService', () => {
  let service: SolicitudesService;
  let repository: MockRepository;

  beforeEach(async () => {
    repository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        { provide: getRepositoryToken(Solicitude), useValue: repository },
      ],
    }).compile();

    service = module.get<SolicitudesService>(SolicitudesService);
  });

  describe('create', () => {
    it('forces estado to PENDIENTE regardless of input', async () => {
      const result = await service.create(
        { cliente: 'Acme', descripcion: 'desc' } as any,
        asesor1,
      );
      expect(result.estado).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('forces asesor to the caller username when role is asesor, ignoring body value', async () => {
      const result = await service.create(
        { cliente: 'Acme', descripcion: 'desc', asesor: 'someone-else' } as any,
        asesor1,
      );
      expect(result.asesor).toBe('asesor1');
    });

    it('requires asesor in the body when created by admin/supervisor', () => {
      expect(() =>
        service.create({ cliente: 'Acme', descripcion: 'desc' } as any, admin1),
      ).toThrow(BadRequestException);
    });

    it('rejects an asesor value that is not an existing user with role asesor', () => {
      expect(() =>
        service.create(
          { cliente: 'Acme', descripcion: 'desc', asesor: 'admin1' } as any,
          supervisor1,
        ),
      ).toThrow(BadRequestException);
    });

    it('accepts a valid asesor username from admin/supervisor', async () => {
      const result = await service.create(
        { cliente: 'Acme', descripcion: 'desc', asesor: 'asesor2' } as any,
        admin1,
      );
      expect(result.asesor).toBe('asesor2');
    });
  });

  describe('findAll', () => {
    it('applies an asesor filter in the database query for asesor role', async () => {
      repository.find.mockResolvedValue([]);
      await service.findAll(asesor1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { asesor: 'asesor1' },
        order: { creadaEn: 'DESC' },
      });
    });

    it('does not filter by asesor for admin/supervisor roles', async () => {
      repository.find.mockResolvedValue([]);
      await service.findAll(admin1);
      expect(repository.find).toHaveBeenCalledWith({
        where: {},
        order: { creadaEn: 'DESC' },
      });
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

    it('allows EN_GESTION -> RESUELTA', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        asesor: 'asesor1',
        estado: EstadoSolicitud.EN_GESTION,
      });

      const result = await service.updateEstado(
        1,
        { estado: EstadoSolicitud.RESUELTA },
        asesor1,
      );
      expect(result.estado).toBe(EstadoSolicitud.RESUELTA);
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

    it('rejects a no-op transition (same state) with 409', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        asesor: 'asesor1',
        estado: EstadoSolicitud.PENDIENTE,
      });

      await expect(
        service.updateEstado(1, { estado: EstadoSolicitud.PENDIENTE }, asesor1),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws NotFoundException when the request is not owned by the asesor', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.updateEstado(1, { estado: EstadoSolicitud.EN_GESTION }, asesor2),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
