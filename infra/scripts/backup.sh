#!/usr/bin/env bash
# Creates a consistent PostgreSQL backup (pg_dump custom format) of the running stack plus a SHA-256 checksum.
# Also archives uploaded media (svetly-media-*.tar.gz).
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

# Uploaded files (photos) live in the media volume, not in the database.
MEDIA="$OUT_DIR/svetly-media-$STAMP.tar.gz"
docker compose -p "$PROJECT" exec -T api tar -C /var/lib/svetly/media -czf - . >"$MEDIA.partial"
mv "$MEDIA.partial" "$MEDIA"
tar -tzf "$MEDIA" >/dev/null
(cd "$OUT_DIR" && sha256sum "$(basename "$MEDIA")" >"$(basename "$MEDIA").sha256")

echo "Backup: $FILE ($(du -h "$FILE" | cut -f1))"
echo "SHA-256: $(cut -d' ' -f1 "$FILE.sha256")"
echo "Media: $MEDIA ($(du -h "$MEDIA" | cut -f1), $(tar -tzf "$MEDIA" | grep -vc '/$') files)"
echo "Not verified until infra/scripts/restore-test.sh $FILE succeeds."
