#!/usr/bin/env bash
# DESTRUCTIVE: replaces the database of the running stack with a backup.
# Usage: infra/scripts/restore.sh <backup.dump>
# Requires typing the database name to confirm. Stops api/web during the restore. Volumes are not removed.
set -euo pipefail
cd "$(dirname "$0")/../.."

FILE="${1:?Usage: restore.sh <backup.dump>}"
PROJECT="${COMPOSE_PROJECT_NAME:-svetly}"
[ -f "$FILE" ] || { echo "No such file: $FILE" >&2; exit 1; }
if [ -f "$FILE.sha256" ]; then
  (cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256")
else
  echo "WARNING: no checksum file $FILE.sha256 — integrity cannot be verified." >&2
fi

DB_NAME="$(docker compose -p "$PROJECT" exec -T db printenv POSTGRES_DB)"
echo "This will REPLACE all data in database \"$DB_NAME\" of compose project \"$PROJECT\" with $FILE."
echo "Make a fresh backup first: infra/scripts/backup.sh"
read -r -p "Type the database name ($DB_NAME) to continue: " ANSWER
[ "$ANSWER" = "$DB_NAME" ] || { echo "Aborted."; exit 1; }

docker compose -p "$PROJECT" stop web api
docker compose -p "$PROJECT" exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction --exit-on-error' <"$FILE"
docker compose -p "$PROJECT" up -d api web
echo "Restore complete. Check: docker compose ps && infra/scripts/smoke.sh"
