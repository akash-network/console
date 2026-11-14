#!/bin/bash
# Restores a seed into a throwaway local Postgres and fails unless it imports cleanly and keeps the data Console reads.
# Writes the seed's applied indexer migrations next to it, for publish-sandbox-seed.sh to check.
set -euo pipefail

SEED_FILE="${1:?usage: verify-sandbox-seed.sh <seed.sql.gz>}"
APPLIED_MIGRATIONS_FILE="${APPLIED_MIGRATIONS_FILE:-$SEED_FILE.migrations}"
MIN_SEED_BYTES="${MIN_SEED_BYTES:-5000000}"
MAX_SEED_BYTES="${MAX_SEED_BYTES:-1000000000}"

fail() {
  echo "SEED_VERIFY: $1"
  exit 1
}

seed_bytes=$(wc -c < "$SEED_FILE" | tr -d ' ')
if [ "$seed_bytes" -lt "$MIN_SEED_BYTES" ] || [ "$seed_bytes" -gt "$MAX_SEED_BYTES" ]; then
  fail "Seed is $seed_bytes bytes, outside $MIN_SEED_BYTES..$MAX_SEED_BYTES."
fi

unset PGPORT PGPASSWORD PGDATABASE PGSSLMODE PGSSLROOTCERT
verify_dir=$(mktemp -d)
export PGHOST="$verify_dir" PGUSER=postgres

stop_verify_postgres() {
  pg_ctl -D "$verify_dir/data" -m immediate stop > /dev/null 2>&1 || true
  rm -rf "$verify_dir"
}
trap stop_verify_postgres EXIT

initdb -D "$verify_dir/data" -U postgres --auth=trust > /dev/null
pg_ctl -D "$verify_dir/data" -o "-c listen_addresses='' -k $verify_dir" -l "$verify_dir/postgres.log" -w start > /dev/null
createdb seed_check

echo "SEED_VERIFY: Restoring $SEED_FILE"
gunzip -c "$SEED_FILE" | psql -X -q -v ON_ERROR_STOP=1 -d seed_check > /dev/null

read -r deployments_missing_block leases_missing_block providers cpu_rows_with_arch tip_height < <(psql -X -At -F ' ' -v ON_ERROR_STOP=1 -d seed_check -c '
  select
    (select count(*) from public.deployment d
      where not exists (select 1 from public.block b where b.height = d."createdHeight")
         or (d."closedHeight" is not null and not exists (select 1 from public.block b where b.height = d."closedHeight"))),
    (select count(*) from public.lease l
      where not exists (select 1 from public.block b where b.height = l."createdHeight")
         or (l."closedHeight" is not null and not exists (select 1 from public.block b where b.height = l."closedHeight"))),
    (select count(*) from public.provider),
    (select count(*) from public."providerSnapshotNodeCPU" where arch is not null),
    (select coalesce(max(height), 0) from public.block)')

echo "SEED_VERIFY: tip=$tip_height providers=$providers cpu_rows_with_arch=$cpu_rows_with_arch"
[ "$deployments_missing_block" -eq 0 ] || fail "$deployments_missing_block deployments point at blocks missing from the seed."
[ "$leases_missing_block" -eq 0 ] || fail "$leases_missing_block leases point at blocks missing from the seed."
[ "$providers" -gt 0 ] || fail "Seed has no providers."
[ "$cpu_rows_with_arch" -gt 0 ] || fail "Seed has no provider CPU rows with arch."
[ "$tip_height" -gt 0 ] || fail "Seed has no blocks."

psql -X -At -v ON_ERROR_STOP=1 -d seed_check -c 'select created_at from drizzle.__drizzle_migrations order by created_at' > "$APPLIED_MIGRATIONS_FILE"
echo "SEED_VERIFY: Done."
