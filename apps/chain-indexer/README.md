# Chain Indexer

Rewrite of the Akash blockchain indexer as an encapsulated app with its own database and, eventually, its own public REST API. Design doc and discussion live in the Linear project (see CON-803).

One codebase, several processes. The role is picked at runtime:

```
INDEXER_ROLE = sync | backfill | api | jobs
NETWORK      = mainnet | sandbox | testnet
```

Currently implemented: `sync` (live tail with per-block atomic commits, advisory-lock leader election, parent-hash continuity check) and a minimal `api` (healthz + status). `backfill` and `jobs` exit with `ROLE_NOT_IMPLEMENTED`.

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
