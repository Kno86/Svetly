#!/usr/bin/env bash
# Creates a consistent PostgreSQL backup (pg_dump custom format) of the running stack plus a SHA-256 checksum.
# Usage: infra/scripts/backup.sh [output-dir]   (default: ./backups, git-ignored)
set -euo pipefail
cd "$(dirname "$0")/../.."

OUT_DIR="${1:-backups}"
PROJECT="${COMPOSE_PROJECT_NAME:-svetly}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/svetly-db-$STAMP.dump"

mkdir -p "$OUT_DIR"
umask 077
docker compose -p "$PROJECT" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner' >"$FILE.partial"
mv "$FILE.partial" "$FILE"
(cd "$OUT_DIR" && sha256sum "$(basename "$FILE")" >"$(basename "$FILE").sha256")

# Sanity check: the archive must be readable by pg_restore.
docker compose -p "$PROJECT" exec -T db pg_restore --list <"$FILE" >/dev/null

echo "Backup: $FILE ($(du -h "$FILE" | cut -f1))"
echo "SHA-256: $(cut -d' ' -f1 "$FILE.sha256")"
echo "Not verified until infra/scripts/restore-test.sh $FILE succeeds."
