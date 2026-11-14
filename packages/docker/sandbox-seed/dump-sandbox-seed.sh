#!/bin/bash
# Dumps the sandbox indexer database without chain history, keeping only the blocks the remaining rows point at.
# Connects with the standard libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, PGSSLMODE).
set -euo pipefail

OUTPUT_FILE="${OUTPUT_FILE:-console-akash-sandbox.sql.gz}"
RECENT_BLOCKS="${RECENT_BLOCKS:-50000}"

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

echo "SEED_DUMP: Dumping \"$PGDATABASE\" to $OUTPUT_FILE"

{
  pg_dump --no-owner --no-acl --section=pre-data
  pg_dump --no-owner --no-acl --section=data "${exclude_args[@]}"
  printf 'COPY public.block FROM stdin;\n'
  psql -X -v ON_ERROR_STOP=1 -c "COPY ($kept_blocks_sql) TO STDOUT"
  printf '\\.\n\n'
  pg_dump --no-owner --no-acl --section=post-data
} | gzip > "$OUTPUT_FILE.partial"

mv "$OUTPUT_FILE.partial" "$OUTPUT_FILE"
echo "SEED_DUMP: Done ($(wc -c < "$OUTPUT_FILE" | tr -d ' ') bytes)."
