#!/bin/bash
# Uploads a verified seed, refusing when it lacks indexer migrations that exist on main.
set -euo pipefail

SEED_FILE="${1:?usage: publish-sandbox-seed.sh <seed.sql.gz>}"
APPLIED_MIGRATIONS_FILE="${APPLIED_MIGRATIONS_FILE:-$SEED_FILE.migrations}"
JOURNAL_URL="${JOURNAL_URL:-https://raw.githubusercontent.com/akash-network/console/main/apps/indexer/drizzle/meta/_journal.json}"
SEED_URI="${SEED_URI:-gs://console-postgresql-backups/console-akash-sandbox.sql.gz}"

journal_file=$(mktemp)
trap 'rm -f "$journal_file"' EXIT
curl -fsSL "$JOURNAL_URL" -o "$journal_file"

journal_entries=$(tr -d ' \n\t' < "$journal_file" | grep -oE '"when":[0-9]+,"tag":"[^"]+"' | sed -E 's/"when":([0-9]+),"tag":"([^"]+)"/\1 \2/' || true)
if [ -z "$journal_entries" ]; then
  echo "SEED_PUBLISH: Found no migrations in $JOURNAL_URL."
  exit 1
fi

missing_migrations=""
while read -r migration_when migration_tag; do
  grep -qx "$migration_when" "$APPLIED_MIGRATIONS_FILE" || missing_migrations+="$migration_tag"$'\n'
done <<< "$journal_entries"

if [ -n "$missing_migrations" ]; then
  echo "SEED_PUBLISH: The source database is missing indexer migrations. Run migration:exec against it first:"
  printf '%s' "$missing_migrations"
  exit 1
fi

echo "SEED_PUBLISH: Uploading $SEED_FILE to $SEED_URI"
gcloud storage cp "$SEED_FILE" "$SEED_URI"
echo "SEED_PUBLISH: Done."
