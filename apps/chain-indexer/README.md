# Chain Indexer

Rewrite of the Akash blockchain indexer as an encapsulated app with its own database and, eventually, its own public REST API. Design doc and discussion live in the Linear project (see CON-803).

One codebase, several processes. The role is picked at runtime:

```
INDEXER_ROLE = sync | backfill | api | jobs
NETWORK      = mainnet | sandbox | testnet
```

Currently implemented: `sync` (live tail with per-block atomic commits, advisory-lock leader election, parent-hash continuity check), `backfill` (historical catch-up over an explicit height range), and a minimal `api` (healthz + status). `jobs` exits with `ROLE_NOT_IMPLEMENTED`.

## Running locally

Create `env/.env` with at least:

```
NETWORK=sandbox
POSTGRES_DB_URI=postgres://user:password@localhost:5432/chain-indexer
```

RPC endpoints default to the network's public nodes from `@akashnetwork/net`; override with a comma-separated `RPC_NODE_ENDPOINTS`. With no checkpoint in the database, sync starts at the current chain tip (set `SYNC_START_HEIGHT` to start elsewhere). Migrations run automatically on boot.

```bash
npm run dev
```

Then check progress:

```bash
curl localhost:3092/v1/status
```

The checkpoint height should advance as blocks land in `cosmos.blocks`, `cosmos.transactions`, and `cosmos.messages`.

## Backfill

The backfill role fills the database over an explicit, inclusive height range and exits when done, so it fits a one-off K8s Job:

```
INDEXER_ROLE=backfill
BACKFILL_FROM_HEIGHT=100000
BACKFILL_TO_HEIGHT=200000
```

Blocks are fetched from RPC in parallel (`BACKFILL_CONCURRENCY`, default 10) and committed strictly in order in batches of `BACKFILL_BATCH_SIZE` blocks (default 200), each batch in one Postgres transaction together with the checkpoint advance. Progress is checkpointed per range under the `indexer_state` stream `backfill:{from}-{to}`, so killing and restarting the job resumes at the checkpoint without gaps or duplicates, and re-running a completed range exits 0 immediately. Changing the range creates a fresh checkpoint row. All inserts are natural-keyed and conflict-ignoring, so a backfill can run against the same database as live sync; a separate advisory lock prevents two concurrent backfills.

## Tests

```bash
npm test
npm run lint -- --quiet
```

## Schema changes

Edit `src/db/schema.ts`, then:

```bash
npm run migration:gen
```
