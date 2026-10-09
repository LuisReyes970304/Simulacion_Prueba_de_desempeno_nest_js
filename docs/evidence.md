# Evidence

Output of `docs/evidence.sh` run against the app (`npm run build && node dist/main.js`) with the
`db` service from `docker-compose.yaml` running locally (`docker compose up -d db`), table truncated
beforehand for deterministic ids. Generated 2026-10-09.

## Swagger docs reachable without any auth header

```
$ curl -s -o /dev/null -w "status: %{http_code}\n" http://localhost:3015/docs
status: 200
```

## No x-api-key -> 401

```
$ curl -s -w "\nstatus: %{http_code}\n" http://localhost:3015/solicitudes
{"success":false,"statusCode":401,"message":"Missing or invalid API key","error":"Unauthorized","path":"/solicitudes","timestamp":"2026-10-09T15:38:33.677Z"}
status: 401
```

## Invalid x-api-key -> 401

```
$ curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: not-a-real-key" -H "x-user: asesor1" http://localhost:3015/solicitudes
{"success":false,"statusCode":401,"message":"Missing or invalid API key","error":"Unauthorized","path":"/solicitudes","timestamp":"2026-10-09T15:38:33.689Z"}
status: 401
```

## Both configured API keys work

```
$ curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: dev-key-123" -H "x-user: asesor1" http://localhost:3015/solicitudes
{"success":true,"statusCode":200,"data":[],"timestamp":"2026-10-09T15:38:33.711Z"}
status: 200

$ curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: qa-key-456" -H "x-user: asesor1" http://localhost:3015/solicitudes
{"success":true,"statusCode":200,"data":[],"timestamp":"2026-10-09T15:38:33.717Z"}
status: 200
```

## Unknown x-user -> 401

```
$ curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: dev-key-123" -H "x-user: ghost" http://localhost:3015/solicitudes
{"success":false,"statusCode":401,"message":"Unknown user","error":"Unauthorized","path":"/solicitudes","timestamp":"2026-10-09T15:38:33.721Z"}
status: 401
```

## Create as asesor1 (estado forced to PENDIENTE, asesor forced to asesor1)

```
$ curl -s -w "\nstatus: %{http_code}\n" -X POST -H "x-api-key: dev-key-123" -H "x-user: asesor1" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Acme Corp","descripcion":"Customer cannot access dashboard"}' \
  http://localhost:3015/solicitudes
{"success":true,"statusCode":201,"data":{"id":1,"cliente":"Acme Corp","descripcion":"Customer cannot access dashboard","asesor":"asesor1","estado":"PENDIENTE","creadaEn":"2026-10-09T20:38:33.733Z","actualizadaEn":"2026-10-09T20:38:33.733Z"},"timestamp":"2026-10-09T15:38:33.739Z"}
status: 201
```

## Create with extra non-whitelisted field (estado) -> 400

```
$ curl -s -w "\nstatus: %{http_code}\n" -X POST -H "x-api-key: dev-key-123" -H "x-user: asesor1" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Acme Corp","descripcion":"desc","estado":"RESUELTA"}' \
  http://localhost:3015/solicitudes
{"success":false,"statusCode":400,"message":["property estado should not exist"],"error":"Bad Request","path":"/solicitudes","timestamp":"2026-10-09T15:38:33.744Z"}
status: 400
```

## Create as admin without asesor -> 400

```
$ curl -s -w "\nstatus: %{http_code}\n" -X POST -H "x-api-key: dev-key-123" -H "x-user: admin1" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Acme Corp","descripcion":"desc"}' \
  http://localhost:3015/solicitudes
{"success":false,"statusCode":400,"message":"asesor is required when creating a request as admin or supervisor","error":"Bad Request","path":"/solicitudes","timestamp":"2026-10-09T15:38:33.748Z"}
status: 400
```

## Create as admin with a valid asesor -> 201

```
$ curl -s -w "\nstatus: %{http_code}\n" -X POST -H "x-api-key: dev-key-123" -H "x-user: admin1" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Acme Corp","descripcion":"desc","asesor":"asesor2"}' \
  http://localhost:3015/solicitudes
{"success":true,"statusCode":201,"data":{"id":2,"cliente":"Acme Corp","descripcion":"desc","asesor":"asesor2","estado":"PENDIENTE","creadaEn":"2026-10-09T20:38:33.753Z","actualizadaEn":"2026-10-09T20:38:33.753Z"},"timestamp":"2026-10-09T15:38:33.755Z"}
status: 201
```

## asesor1 lists only their own requests

```
$ curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: dev-key-123" -H "x-user: asesor1" http://localhost:3015/solicitudes
{"success":true,"statusCode":200,"data":[{"id":1,"cliente":"Acme Corp","descripcion":"Customer cannot access dashboard","asesor":"asesor1","estado":"PENDIENTE","creadaEn":"2026-10-09T20:38:33.733Z","actualizadaEn":"2026-10-09T20:38:33.733Z"}],"timestamp":"2026-10-09T15:38:33.762Z"}
status: 200
```

Note only the request assigned to `asesor1` is returned, even though a second request (id 2, assigned
to `asesor2`) also exists — the filter is applied in the database query, never in memory.

## asesor2 cannot GET asesor1's request by id -> 404

```
$ curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: dev-key-123" -H "x-user: asesor2" http://localhost:3015/solicitudes/1
{"success":false,"statusCode":404,"message":"Solicitude with id 1 not found","error":"Not Found","path":"/solicitudes/1","timestamp":"2026-10-09T15:38:33.771Z"}
status: 404
```

## Valid transition PENDIENTE -> EN_GESTION

```
$ curl -s -w "\nstatus: %{http_code}\n" -X PATCH -H "x-api-key: dev-key-123" -H "x-user: asesor1" \
  -H "Content-Type: application/json" -d '{"estado":"EN_GESTION"}' \
  http://localhost:3015/solicitudes/1/estado
{"success":true,"statusCode":200,"data":{"id":1,"cliente":"Acme Corp","descripcion":"Customer cannot access dashboard","asesor":"asesor1","estado":"EN_GESTION","creadaEn":"2026-10-09T20:38:33.733Z","actualizadaEn":"2026-10-09T20:38:33.785Z"},"timestamp":"2026-10-09T15:38:33.789Z"}
status: 200
```

## Invalid transition EN_GESTION -> PENDIENTE -> 409

```
$ curl -s -w "\nstatus: %{http_code}\n" -X PATCH -H "x-api-key: dev-key-123" -H "x-user: asesor1" \
  -H "Content-Type: application/json" -d '{"estado":"PENDIENTE"}' \
  http://localhost:3015/solicitudes/1/estado
{"success":false,"statusCode":409,"message":"Invalid state transition from EN_GESTION to PENDIENTE. Allowed: EN_GESTION -> RESUELTA","error":"Conflict","path":"/solicitudes/1/estado","timestamp":"2026-10-09T15:38:33.798Z"}
status: 409
```

## Non-numeric id -> 400

```
$ curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: dev-key-123" -H "x-user: asesor1" http://localhost:3015/solicitudes/abc
{"success":false,"statusCode":400,"message":"Validation failed (numeric string is expected)","error":"Bad Request","path":"/solicitudes/abc","timestamp":"2026-10-09T15:38:33.804Z"}
status: 400
```
