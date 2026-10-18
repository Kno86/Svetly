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
check "auth get-session (anonymous)" curl -fsS "$BASE_URL/api/auth/get-session"
check "api /api/me rejects anonymous (401)" sh -c "test \"\$(curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/api/me')\" = 401 && echo 401"
check "auth POST without origin rejected (403)" sh -c "test \"\$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' '$BASE_URL/api/auth/sign-in/email')\" = 403 && echo 403"
check "web /login" sh -c "curl -fsS '$BASE_URL/login' | grep -o 'Вход' | head -n1"
check "audit_log append-only trigger" docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select tgname from pg_trigger where tgname = '"'"'audit_log_no_update_delete'"'"'"'
check "rbac roles seeded" docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select string_agg(code, '"'"','"'"' order by rank) from roles"'
check "mailpit (local SMTP sink)" docker compose exec -T api sh -c 'nc -z -w 3 mailpit 1025 && echo smtp-open'
echo "smoke: all checks passed"
