# Gestor de Solicitudes

A NestJS REST API for managing customer service requests (`solicitudes`). Requests are created by
advisors (or on their behalf by admins/supervisors), tracked through a fixed state machine
(`PENDIENTE -> EN_GESTION -> RESUELTA`), and scoped per advisor so each advisor only ever sees their
own work.

Access control is header-based (API key + a server-trusted user identity) rather than JWT, matching
the scope of this assessment: no login flow, no user entity, no frontend.

## Tech stack

- [NestJS](https://nestjs.com/) 12 (Express platform)
- [TypeORM](https://typeorm.io/) + PostgreSQL
- [class-validator](https://github.com/typestack/class-validator) / [class-transformer](https://github.com/typestack/class-transformer) for DTO validation
- [Swagger](https://docs.nestjs.com/openapi/introduction) for API documentation
- [Vitest](https://vitest.dev/) + [supertest](https://github.com/ladjs/supertest) for unit and e2e tests
- Docker / docker-compose for local orchestration

## Database change: SQLite -> PostgreSQL

The original assessment brief specified SQLite. The Scrum Master later changed this requirement to
**PostgreSQL** for the whole project, to keep the exercise closer to a real deployment (connection
pooling, proper enum columns, concurrent access) and to standardize all assessment submissions on the
same database engine. The app module, `docker-compose.yaml`, and all configuration in this repo are
built around Postgres (`type: 'postgres'` in `TypeOrmModule`, a `db` service in docker-compose using
`postgres:15.3-alpine`) — there is no SQLite code path to migrate away from.

## Prerequisites

- Node.js 24+
- npm
- Docker and Docker Compose (for PostgreSQL, and optionally for running the whole app)

## Setup

```bash
cp .env.example .env
```

Fill in the values if you need something other than the committed defaults (see the comments in
`.env.example`, in particular `POSTGRES_HOST`, which must be `db` for docker-compose or `localhost`
for a local run).

## Running with Docker Compose (full stack)

Runs both the API and PostgreSQL as containers:

```bash
docker compose up -d
```

The API will be reachable at `http://localhost:${PORT}` (see your `.env`).

## Running locally (API on the host, DB in Docker)

Starts only PostgreSQL in Docker, and runs the Nest app with the host Node.js toolchain (hot reload):

```bash
docker compose up -d db
npm install
npm run start:dev
```

For this mode, set `POSTGRES_HOST=localhost` in `.env` (the default committed in `.env.example`).

## API documentation (Swagger)

Once running, Swagger UI is available at:

```
http://localhost:${PORT}/docs
```

The `/docs` route is served outside of Nest's controller/guard pipeline, so it is reachable **without**
any auth headers — only the `/solicitudes` endpoints are protected.

To try protected endpoints from Swagger UI, click **Authorize** and fill in both schemes:

- `x-api-key`: one of the keys from `API_KEYS` in your `.env` (e.g. `dev-key-123`)
- `x-user`: one of the test usernames below (e.g. `asesor1`)

## Test users and roles

There is no user entity or database table for users — they are an in-memory constant
(`src/auth/users.ts`) used only to resolve a role from the `x-user` header. The role attached to a
request is **always** resolved server-side from this list; a client cannot send its own role.

| username      | role         |
|---------------|--------------|
| `admin1`      | `admin`      |
| `supervisor1` | `supervisor` |
| `asesor1`     | `asesor`     |
| `asesor2`     | `asesor`     |

## Endpoints

All endpoints require `x-api-key` and `x-user` headers.

| Method | Path                    | Roles                       | Description                                   |
|--------|--------------------------|------------------------------|------------------------------------------------|
| POST   | `/solicitudes`           | admin, supervisor, asesor   | Create a request                              |
| GET    | `/solicitudes`           | admin, supervisor, asesor   | List requests (scoped per role, see below)    |
| GET    | `/solicitudes/:id`       | admin, supervisor, asesor   | Get a single request by id                    |
| PATCH  | `/solicitudes/:id/estado`| admin, supervisor, asesor   | Change a request's state                      |

## Business rules and HTTP status codes

- **Authentication (401)** — `ApiKeyGuard` rejects any request with a missing/unknown `x-api-key`;
  `UserGuard` rejects any request with a missing/unknown `x-user`. Both run before any endpoint logic,
  so an unauthenticated caller never reaches business code. 401 is the correct code for "who are you"
  failures, distinct from authorization failures.
- **Authorization (403)** — `RolesGuard` checks the `@Roles(...)` metadata on the handler against the
  server-resolved role. All endpoints in this API accept every role, but the decorator and guard are
  still wired end-to-end (and would return 403) to demonstrate role-based access control as required.
- **Validation (400)** — the global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`,
  `transform: true`) rejects missing/empty/wrong-typed fields and any field not declared on the DTO
  (e.g. a client trying to send `estado` or `id` on create). `ParseIntPipe` on `:id` returns 400 for a
  non-numeric id. This guarantees protected fields (`id`, `estado`, `creadaEn`, `actualizadaEn`) can
  never be set by the client on create.
- **RN-01 (create)** — `estado` is always forced to `PENDIENTE`, ignoring any client value (impossible
  anyway, since `CreateSolicitudeDto` doesn't even declare `estado`). If the caller is an `asesor`,
  `asesor` is forced to the caller's own username. If the caller is `admin`/`supervisor`, `asesor` is
  required in the body and must name an existing user whose role is `asesor`, otherwise **400**.
- **RN-02 (list)** — `admin`/`supervisor` see every request; an `asesor` only sees requests where
  `asesor = <their username>`. This filter is applied as a TypeORM `where` clause, never by fetching
  everything and filtering in memory. Results are ordered by `creadaEn` descending.
- **Ownership / not found (404)** — `GET /solicitudes/:id` and `PATCH /solicitudes/:id/estado` apply
  the same ownership-scoped lookup as the list endpoint for an `asesor`. A request that doesn't exist
  and a request that exists but belongs to another advisor both return **404** (not 403) — this is
  deliberate, so an advisor cannot use the response code to infer that a request they don't own
  actually exists.
- **RN-03 (state transition, 409)** — only `PENDIENTE -> EN_GESTION` and `EN_GESTION -> RESUELTA` are
  allowed. Any other transition — a no-op (same state), skipping a step (`PENDIENTE -> RESUELTA`), or
  reopening a resolved request (`RESUELTA -> ...`) — returns **409 Conflict** with a message naming the
  attempted and allowed transitions, e.g.:
  `Invalid state transition from PENDIENTE to RESUELTA. Allowed: PENDIENTE -> EN_GESTION`.

## Response format

All responses go through a global interceptor and exception filter so every response — success or
error — has a predictable shape.

Success (`ResponseInterceptor`):

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "id": 1, "cliente": "Acme Corp", "...": "..." },
  "timestamp": "2026-10-09T15:38:33.739Z"
}
```

Error (`HttpExceptionFilter`):

```json
{
  "success": false,
  "statusCode": 409,
  "message": "Invalid state transition from PENDIENTE to RESUELTA. Allowed: PENDIENTE -> EN_GESTION",
  "error": "Conflict",
  "path": "/solicitudes/1/estado",
  "timestamp": "2026-10-09T15:38:33.798Z"
}
```

Validation errors keep the real HTTP status (400/401/403/404/409) and `message` is the array of
validation messages produced by `class-validator`. A `QueryFailedError` from TypeORM is mapped to a
generic 400 instead of leaking SQL/driver internals. Any other unknown error becomes a generic 500
(`Internal server error`), with the real error logged server-side via the Nest `Logger`.

## Tests and evidence

```bash
npm run build      # compiles the project
npm run test        # unit tests (service logic, with the repository mocked via getRepositoryToken)
npm run test:e2e    # e2e tests against a real Postgres instance (requires `docker compose up -d db`)
```

The e2e suite (`test/app.e2e-spec.ts`) clears the `solicitudes` table in `beforeEach` and exercises the
full stack against the real database: authentication, DTO validation, ownership scoping, state
transitions, and the response/error envelope shapes.

`docs/evidence.sh` is a curl script covering the main acceptance scenarios end-to-end; its output
against a running instance is saved in `docs/evidence.md`.

## Project structure

```
src/
  auth/
    decorators/        # @Roles, @CurrentUser
    guards/             # ApiKeyGuard, UserGuard, RolesGuard (registered globally, in that order)
    users.ts            # in-memory test users
    auth.module.ts
  common/
    interceptors/       # ResponseInterceptor (success envelope)
    filters/            # HttpExceptionFilter (error envelope)
  config/
    configuration.ts     # env parsing (port, apiKeys, database)
  solicitudes/
    dto/                 # CreateSolicitudeDto, UpdateEstadoDto
    entities/            # Solicitude (TypeORM entity, table "solicitudes")
    enums/               # EstadoSolicitud
    solicitudes.controller.ts
    solicitudes.service.ts   # RN-01/RN-02/RN-03 business rules live here
    solicitudes.module.ts
  app.module.ts
  main.ts
test/
  app.e2e-spec.ts
docs/
  evidence.sh / evidence.md
```
