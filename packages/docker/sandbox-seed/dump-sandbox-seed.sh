#!/bin/bash
# Dumps the sandbox indexer database without chain history, keeping only the blocks the remaining rows point at.
# Connects with the standard libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, PGSSLMODE).
set -euo pipefail

OUTPUT_FILE="${OUTPUT_FILE:-console-akash-sandbox.sql.gz}"
RECENT_BLOCKS="${RECENT_BLOCKS:-50000}"
SNAPSHOT_ATTEMPTS="${SNAPSHOT_ATTEMPTS:-30}"
SNAPSHOT_RETRY_SECONDS="${SNAPSHOT_RETRY_SECONDS:-10}"

HISTORY_TABLES=(transaction_event_attribute transaction_event message addressReference transaction block)

# Height columns the API joins to block through Sequelize associations only, so they have no foreign key to discover.
MODEL_BLOCK_REFERENCES=(
  day:firstBlockHeight
  day:lastBlockHeight
  day:lastBlockHeightYet
  deployment:createdHeight
  deployment:closedHeight
  lease:createdHeight
  lease:closedHeight
  provider:createdHeight
)

if [ -z "${PGDATABASE:-}" ]; then
  echo "SEED_DUMP: PGDATABASE is not set."
  exit 1
fi

exclude_args=()
history_tables_sql=""
for table in "${HISTORY_TABLES[@]}"; do
  exclude_args+=("--exclude-table-data=public.\"$table\"")
  history_tables_sql+="${history_tables_sql:+,}'$table'"
done

foreign_key_references_sql=$(psql -X -At -v ON_ERROR_STOP=1 -c "
  select string_agg(format('select %I::bigint from public.%I', a.attname, cl.relname), ' union ')
  from pg_constraint c
  join pg_class cl on cl.oid = c.conrelid
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f'
    and c.confrelid = 'public.block'::regclass
    and cl.relname <> all (array[$history_tables_sql])")

block_references_sql="$foreign_key_references_sql"
for reference in "${MODEL_BLOCK_REFERENCES[@]}"; do
  block_references_sql+="${block_references_sql:+ union }select \"${reference#*:}\"::bigint from public.\"${reference%%:*}\""
done

kept_blocks_sql="
  select b.* from public.block b
  where b.height > (select max(height) - $RECENT_BLOCKS from public.block)
     or b.height in ($block_references_sql)
  order by b.height"

snapshot_dir=$(mktemp -d)
mkfifo "$snapshot_dir/requests" "$snapshot_dir/replies"
psql -X -q -At -v ON_ERROR_STOP=1 < "$snapshot_dir/requests" > "$snapshot_dir/replies" &
snapshot_session_pid=$!
exec 3> "$snapshot_dir/requests" 4< "$snapshot_dir/replies"

close_snapshot_session() {
  exec 3>&- 4<&-
  wait "$snapshot_session_pid" 2> /dev/null || true
  rm -rf "$snapshot_dir"
}
trap close_snapshot_session EXIT

# A block the indexer has stored but not processed would be skipped after restore, losing its deployment and lease changes.
snapshot_id=""
for attempt in $(seq 1 "$SNAPSHOT_ATTEMPTS"); do
  echo 'begin isolation level repeatable read read only;' >&3
  echo 'select pg_export_snapshot() || '"' '"' || count(*) from public.block where not "isProcessed";' >&3
  read -r exported_snapshot unprocessed_blocks <&4
  if [ "$unprocessed_blocks" -eq 0 ]; then
    snapshot_id="$exported_snapshot"
    break
  fi
  echo "SEED_DUMP: $unprocessed_blocks unprocessed blocks (attempt $attempt/$SNAPSHOT_ATTEMPTS), retrying in ${SNAPSHOT_RETRY_SECONDS}s"
  echo 'rollback;' >&3
  sleep "$SNAPSHOT_RETRY_SECONDS"
done

if [ -z "$snapshot_id" ]; then
  echo "SEED_DUMP: The indexer kept unprocessed blocks through every attempt."
  exit 1
fi

echo "SEED_DUMP: Dumping \"$PGDATABASE\" to $OUTPUT_FILE"

{
  pg_dump --no-owner --no-acl --snapshot="$snapshot_id" --section=pre-data
  pg_dump --no-owner --no-acl --snapshot="$snapshot_id" --section=data "${exclude_args[@]}"
  printf 'COPY public.block FROM stdin;\n'
  psql -X -q -v ON_ERROR_STOP=1 \
    -c 'begin isolation level repeatable read read only' \
    -c "set transaction snapshot '$snapshot_id'" \
    -c "COPY ($kept_blocks_sql) TO STDOUT" \
    -c 'commit'
  printf '\\.\n\n'
  pg_dump --no-owner --no-acl --snapshot="$snapshot_id" --section=post-data
} | gzip > "$OUTPUT_FILE.partial"

mv "$OUTPUT_FILE.partial" "$OUTPUT_FILE"
echo "SEED_DUMP: Done ($(wc -c < "$OUTPUT_FILE" | tr -d ' ') bytes)."
