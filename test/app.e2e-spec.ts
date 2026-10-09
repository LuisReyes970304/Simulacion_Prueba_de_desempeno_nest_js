import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { Solicitude } from '../src/solicitudes/entities/solicitude.entity.js';

const API_KEY = 'dev-key-123';
const OTHER_API_KEY = 'qa-key-456';

describe('Solicitudes (e2e)', () => {
  let app: INestApplication<App>;
  let solicitudeRepository: Repository<Solicitude>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    solicitudeRepository = moduleFixture.get<Repository<Solicitude>>(
      getRepositoryToken(Solicitude),
    );
  });

  beforeEach(async () => {
    await solicitudeRepository.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it('rejects requests without x-api-key', async () => {
      const res = await request(app.getHttpServer()).get('/solicitudes');
      expect(res.status).toBe(401);
    });

    it('rejects requests with an invalid x-api-key', async () => {
      const res = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('x-api-key', 'not-a-real-key')
        .set('x-user', 'asesor1');
      expect(res.status).toBe(401);
    });

    it('accepts both configured API keys', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1');
      expect(res1.status).toBe(200);

      const res2 = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('x-api-key', OTHER_API_KEY)
        .set('x-user', 'asesor1');
      expect(res2.status).toBe(200);
    });

    it('rejects an unknown x-user', async () => {
      const res = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'ghost');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /solicitudes validation', () => {
    it('rejects a missing field', async () => {
      const res = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ cliente: 'Acme' });
      expect(res.status).toBe(400);
    });

    it('rejects an empty-string field', async () => {
      const res = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ cliente: '   ', descripcion: 'desc' });
      expect(res.status).toBe(400);
    });

    it('rejects a wrong type', async () => {
      const res = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ cliente: 123, descripcion: 'desc' });
      expect(res.status).toBe(400);
    });

    it('rejects an extra, non-whitelisted field like estado', async () => {
      const res = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ cliente: 'Acme', descripcion: 'desc', estado: 'RESUELTA' });
      expect(res.status).toBe(400);
    });

    it('rejects an extra, non-whitelisted field like id', async () => {
      const res = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ id: 999, cliente: 'Acme', descripcion: 'desc' });
      expect(res.status).toBe(400);
    });
  });

  describe('business rules', () => {
    it('persists a new request and forces estado/asesor for an asesor caller', async () => {
      const res = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ cliente: 'Acme', descripcion: 'Cannot login', asesor: 'asesor2' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.estado).toBe('PENDIENTE');
      expect(res.body.data.asesor).toBe('asesor1');

      const found = await solicitudeRepository.findOne({ where: { id: res.body.data.id } });
      expect(found).not.toBeNull();
    });

    it('requires a valid asesor in the body when created by admin/supervisor', async () => {
      const missing = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'admin1')
        .send({ cliente: 'Acme', descripcion: 'desc' });
      expect(missing.status).toBe(400);

      const invalid = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'admin1')
        .send({ cliente: 'Acme', descripcion: 'desc', asesor: 'admin1' });
      expect(invalid.status).toBe(400);

      const valid = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'admin1')
        .send({ cliente: 'Acme', descripcion: 'desc', asesor: 'asesor1' });
      expect(valid.status).toBe(201);
      expect(valid.body.data.asesor).toBe('asesor1');
    });

    it('lets an asesor only see their own requests', async () => {
      await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ cliente: 'Acme', descripcion: 'desc 1' });

      await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor2')
        .send({ cliente: 'Acme', descripcion: 'desc 2' });

      const asesor1List = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1');
      expect(asesor1List.body.data).toHaveLength(1);
      expect(asesor1List.body.data[0].asesor).toBe('asesor1');

      const adminList = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'admin1');
      expect(adminList.body.data).toHaveLength(2);
    });

    it('does not let an asesor GET another advisor\'s request by id (404)', async () => {
      const created = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ cliente: 'Acme', descripcion: 'desc' });

      const res = await request(app.getHttpServer())
        .get(`/solicitudes/${created.body.data.id}`)
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor2');
      expect(res.status).toBe(404);
    });

    it('does not let an asesor PATCH another advisor\'s request by id (404)', async () => {
      const created = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ cliente: 'Acme', descripcion: 'desc' });

      const res = await request(app.getHttpServer())
        .patch(`/solicitudes/${created.body.data.id}/estado`)
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor2')
        .send({ estado: 'EN_GESTION' });
      expect(res.status).toBe(404);
    });

    it('rejects invalid state transitions with 409', async () => {
      const created = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ cliente: 'Acme', descripcion: 'desc' });

      const res = await request(app.getHttpServer())
        .patch(`/solicitudes/${created.body.data.id}/estado`)
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ estado: 'RESUELTA' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Conflict');
    });

    it('allows the valid transition chain PENDIENTE -> EN_GESTION -> RESUELTA', async () => {
      const created = await request(app.getHttpServer())
        .post('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ cliente: 'Acme', descripcion: 'desc' });

      const toEnGestion = await request(app.getHttpServer())
        .patch(`/solicitudes/${created.body.data.id}/estado`)
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ estado: 'EN_GESTION' });
      expect(toEnGestion.status).toBe(200);
      expect(toEnGestion.body.data.estado).toBe('EN_GESTION');

      const toResuelta = await request(app.getHttpServer())
        .patch(`/solicitudes/${created.body.data.id}/estado`)
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1')
        .send({ estado: 'RESUELTA' });
      expect(toResuelta.status).toBe(200);
      expect(toResuelta.body.data.estado).toBe('RESUELTA');
    });
  });

  describe('response shapes', () => {
    it('wraps a successful response in the interceptor envelope', async () => {
      const res = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        statusCode: 200,
        data: expect.any(Array),
      });
      expect(typeof res.body.timestamp).toBe('string');
    });

    it('wraps an error response in the filter envelope with the correct status', async () => {
      const res = await request(app.getHttpServer())
        .get('/solicitudes/999999')
        .set('x-api-key', API_KEY)
        .set('x-user', 'asesor1');

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        success: false,
        statusCode: 404,
        error: 'Not Found',
        path: '/solicitudes/999999',
      });
      expect(typeof res.body.message).toBe('string');
      expect(typeof res.body.timestamp).toBe('string');
    });
  });
});
