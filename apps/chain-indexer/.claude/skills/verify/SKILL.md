---
name: verify
description: Build, launch, and drive apps/chain-indexer locally to verify sync/backfill/archive changes end-to-end against sandbox RPC, a scratch Postgres, and a fake-gcs-server emulator.
---

# Verifying chain-indexer locally

## Build and run

```bash
cd apps/chain-indexer
npm run build                 # tsup -> dist/server.js (CJS)
node dist/server.js           # role picked via INDEXER_ROLE env
```

Pass config as process env vars; they override `env/.env*` (dotenvx does not overwrite existing env). Minimum: `NETWORK=sandbox POSTGRES_DB_URI=postgres://postgres:password@localhost:5432/<scratch-db>`. Migrations run on boot. Sandbox RPC defaults from `@akashnetwork/net` work; the chain id is `sandbox-2` and history is unpruned from height 1.

- `INDEXER_ROLE=sync` tails the chain (`SYNC_START_HEIGHT` to pin the start); stop it with SIGTERM (orderly shutdown, exit 0).
- `INDEXER_ROLE=backfill BACKFILL_FROM_HEIGHT=... BACKFILL_TO_HEIGHT=...` runs to completion and exits 0; interrupted runs exit 1 and resume from the per-range checkpoint on rerun.

macOS has no `timeout`; to bound a run, spawn `node dist/server.js` from a wrapper that `child.kill("SIGTERM")`s after N ms.

## Scratch Postgres

Local native PG accepts `postgres://postgres:password@localhost:5432`. Create/drop a scratch DB per run:

```bash
psql postgres://postgres:password@localhost:5432/postgres -c "CREATE DATABASE chain_indexer_e2e"
```

## Archive verification (GCS emulator)

```bash
docker run -d --name fake-gcs -p 4443:4443 fsouza/fake-gcs-server -scheme http
curl -X POST "http://localhost:4443/storage/v1/b?project=test" -H "Content-Type: application/json" -d '{"name":"raw-blocks"}'
```

Run the indexer with `ARCHIVE_BUCKET=raw-blocks ARCHIVE_STORAGE_API_ENDPOINT=http://localhost:4443`.

**Gotcha:** do NOT use `STORAGE_EMULATOR_HOST` — it flips @google-cloud/storage into custom-endpoint mode with unprefixed paths (`GET /b/...`); fake-gcs-server only serves `/storage/v1/...`, so saves appear to work but every download 404s and the archive silently falls back to RPC. `ARCHIVE_STORAGE_API_ENDPOINT` (the `apiEndpoint` option) keeps standard paths and both directions work.

Inspect objects with the emulator's JSON API (`generation` proves idempotent no-rewrite):

```bash
curl "http://localhost:4443/storage/v1/b/raw-blocks/o?prefix=sandbox-2/chunks/"
```

## Proving "no RPC block fetches" (AC2-style checks)

Point `RPC_NODE_ENDPOINTS` at a local counting proxy that forwards to `https://rpc.sandbox-2.aksh.pw` and tallies paths; expose the tally on a magic route and assert `/block` and `/block_results` are absent. An archive-served 2,000-block replay does ~2 `/status` calls and finishes in ~2s (vs ~80s RPC-fed).

## Log levels

Per-block events (`BLOCK_COMMITTED`) are debug; `LOG_LEVEL=info` shows `SYNC_PROGRESS` only every 100 blocks. Judge sync activity by DB rows or bucket objects, not info-level log counts.
