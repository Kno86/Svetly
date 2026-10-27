#!/usr/bin/env bash
# Verifies a backup by restoring it into a throw-away PostgreSQL container (isolated compose project,
# own network and volume) and checking schema and data. The live stack and its volumes are not touched.
# Usage: infra/scripts/restore-test.sh <backup.dump>
set -euo pipefail
cd "$(dirname "$0")/../.."

FILE="${1:?Usage: restore-test.sh <backup.dump> [media.tar.gz]}"
MEDIA="${2:-}"
TEST_PROJECT="svetly-restore-test"
[ "${COMPOSE_PROJECT_NAME:-svetly}" != "$TEST_PROJECT" ] || { echo "Refusing: test project equals live project" >&2; exit 1; }
[ -f "$FILE" ] || { echo "No such file: $FILE" >&2; exit 1; }
(cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256")

cleanup() {
  docker compose -p "$TEST_PROJECT" -f compose.yaml down -v --remove-orphans >/dev/null 2>&1 || true
  docker volume rm "$TEST_PROJECT-media" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

docker compose -p "$TEST_PROJECT" -f compose.yaml up -d --wait db
psql_test() { docker compose -p "$TEST_PROJECT" -f compose.yaml exec -T db sh -c "psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -At -c \"$1\""; }

docker compose -p "$TEST_PROJECT" -f compose.yaml exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --single-transaction --exit-on-error' <"$FILE"

echo "Migrations: $(psql_test 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')"
echo "Users: $(psql_test 'SELECT count(*) FROM users')"
echo "Roles: $(psql_test 'SELECT count(*) FROM roles')"
echo "Audit entries: $(psql_test 'SELECT count(*) FROM audit_log')"
[ "$(psql_test 'SELECT count(*) FROM roles')" -gt 0 ] || { echo "FAIL: roles table empty" >&2; exit 1; }
[ "$(psql_test "SELECT count(*) FROM pg_trigger WHERE tgname = 'audit_log_no_update_delete'")" = 1 ] || { echo "FAIL: audit trigger missing" >&2; exit 1; }
if [ -n "$MEDIA" ]; then
  (cd "$(dirname "$MEDIA")" && sha256sum -c "$(basename "$MEDIA").sha256")
  # Unpack into a throw-away volume using the already pulled postgres image (has tar); no app image build needed.
  N=$(docker run --rm -i -v "$TEST_PROJECT-media:/media" --entrypoint sh postgres:18.6-alpine3.24 \
    -c 'tar -xzf - -C /media && find /media -type f | wc -l' <"$MEDIA")
  echo "Media files restored: $N"
  [ "$N" = "$(tar -tzf "$MEDIA" | grep -vc '/$')" ] || { echo "FAIL: media file count mismatch" >&2; exit 1; }
fi
echo "Restore test PASSED for $FILE"
