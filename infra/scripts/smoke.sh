#!/usr/bin/env sh
# Smoke test for a running local stack (docker compose up -d --build).
# Checks the public entry point on the host and the API on the internal network.
set -eu

BASE_URL="${BASE_URL:-http://localhost:3000}"

check() {
  name="$1"; shift
  if out="$("$@" 2>&1)"; then
    echo "ok   $name: $out"
  else
    echo "FAIL $name: $out" >&2
    exit 1
  fi
}

check "web /healthz" curl -fsS "$BASE_URL/healthz"
check "web /" sh -c "curl -fsS '$BASE_URL/' | grep -o 'SVETLY' | head -n1"
check "api via web /api/health/ready" curl -fsS "$BASE_URL/api/health/ready"
check "api via web /api/version" curl -fsS "$BASE_URL/api/version"
check "api internal /api/health/live" docker compose exec -T api wget -qO- http://127.0.0.1:4000/api/health/live
check "db pg_isready" docker compose exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
check "migrations" docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select migration_name from _prisma_migrations where finished_at is not null order by 1"'
echo "smoke: all checks passed"
