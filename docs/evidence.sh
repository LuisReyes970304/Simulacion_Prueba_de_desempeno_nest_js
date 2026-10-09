#!/usr/bin/env bash
# Evidence script: curl commands covering the main acceptance scenarios.
# Usage: BASE_URL=http://localhost:3015 ./docs/evidence.sh
set -u

BASE_URL="${BASE_URL:-http://localhost:3015}"
API_KEY="dev-key-123"
OTHER_API_KEY="qa-key-456"

section() {
  echo
  echo "=============================================="
  echo "## $1"
  echo "=============================================="
}

run() {
  echo
  echo "\$ $*"
  "$@"
  echo
}

section "Swagger docs reachable without any auth header"
run curl -s -o /dev/null -w "status: %{http_code}\n" "$BASE_URL/docs"

section "No x-api-key -> 401"
run curl -s -w "\nstatus: %{http_code}\n" "$BASE_URL/solicitudes"

section "Invalid x-api-key -> 401"
run curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: not-a-real-key" -H "x-user: asesor1" "$BASE_URL/solicitudes"

section "Both configured API keys work"
run curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: $API_KEY" -H "x-user: asesor1" "$BASE_URL/solicitudes"
run curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: $OTHER_API_KEY" -H "x-user: asesor1" "$BASE_URL/solicitudes"

section "Unknown x-user -> 401"
run curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: $API_KEY" -H "x-user: ghost" "$BASE_URL/solicitudes"

section "Create as asesor1 (estado forced to PENDIENTE, asesor forced to asesor1)"
run curl -s -w "\nstatus: %{http_code}\n" -X POST \
  -H "x-api-key: $API_KEY" -H "x-user: asesor1" -H "Content-Type: application/json" \
  -d '{"cliente":"Acme Corp","descripcion":"Customer cannot access dashboard"}' \
  "$BASE_URL/solicitudes"

section "Create with extra non-whitelisted field (estado) -> 400"
run curl -s -w "\nstatus: %{http_code}\n" -X POST \
  -H "x-api-key: $API_KEY" -H "x-user: asesor1" -H "Content-Type: application/json" \
  -d '{"cliente":"Acme Corp","descripcion":"desc","estado":"RESUELTA"}' \
  "$BASE_URL/solicitudes"

section "Create as admin without asesor -> 400"
run curl -s -w "\nstatus: %{http_code}\n" -X POST \
  -H "x-api-key: $API_KEY" -H "x-user: admin1" -H "Content-Type: application/json" \
  -d '{"cliente":"Acme Corp","descripcion":"desc"}' \
  "$BASE_URL/solicitudes"

section "Create as admin with a valid asesor -> 201"
run curl -s -w "\nstatus: %{http_code}\n" -X POST \
  -H "x-api-key: $API_KEY" -H "x-user: admin1" -H "Content-Type: application/json" \
  -d '{"cliente":"Acme Corp","descripcion":"desc","asesor":"asesor2"}' \
  "$BASE_URL/solicitudes"

section "asesor1 lists only their own requests"
run curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: $API_KEY" -H "x-user: asesor1" "$BASE_URL/solicitudes"

section "asesor2 cannot GET asesor1's request by id -> 404"
run curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: $API_KEY" -H "x-user: asesor2" "$BASE_URL/solicitudes/1"

section "Valid transition PENDIENTE -> EN_GESTION"
run curl -s -w "\nstatus: %{http_code}\n" -X PATCH \
  -H "x-api-key: $API_KEY" -H "x-user: asesor1" -H "Content-Type: application/json" \
  -d '{"estado":"EN_GESTION"}' \
  "$BASE_URL/solicitudes/1/estado"

section "Invalid transition EN_GESTION -> PENDIENTE -> 409"
run curl -s -w "\nstatus: %{http_code}\n" -X PATCH \
  -H "x-api-key: $API_KEY" -H "x-user: asesor1" -H "Content-Type: application/json" \
  -d '{"estado":"PENDIENTE"}' \
  "$BASE_URL/solicitudes/1/estado"

section "Non-numeric id -> 400"
run curl -s -w "\nstatus: %{http_code}\n" -H "x-api-key: $API_KEY" -H "x-user: asesor1" "$BASE_URL/solicitudes/abc"
