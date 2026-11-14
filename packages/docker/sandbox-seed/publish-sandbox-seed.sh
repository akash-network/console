#!/bin/bash
# Uploads a verified seed, refusing when it lacks indexer migrations that exist on main.
set -euo pipefail

SEED_FILE="${1:?usage: publish-sandbox-seed.sh <seed.sql.gz>}"
APPLIED_MIGRATIONS_FILE="${APPLIED_MIGRATIONS_FILE:-$SEED_FILE.migrations}"
JOURNAL_URL="${JOURNAL_URL:-https://raw.githubusercontent.com/akash-network/console/main/apps/indexer/drizzle/meta/_journal.json}"
SEED_URI="${SEED_URI:-gs://console-postgresql-backups/console-akash-sandbox.sql.gz}"

missing_migrations=$(curl -fsSL "$JOURNAL_URL" | python3 -c '
import json, sys
applied = set(open(sys.argv[1]).read().split())
for entry in json.load(sys.stdin)["entries"]:
    if str(entry["when"]) not in applied:
        print(entry["tag"])
' "$APPLIED_MIGRATIONS_FILE")

if [ -n "$missing_migrations" ]; then
  echo "SEED_PUBLISH: The source database is missing indexer migrations. Run migration:exec against it first:"
  echo "$missing_migrations"
  exit 1
fi

echo "SEED_PUBLISH: Uploading $SEED_FILE to $SEED_URI"
gcloud storage cp "$SEED_FILE" "$SEED_URI"
echo "SEED_PUBLISH: Done."
