# Chain Indexer

Rewrite of the Akash blockchain indexer as an encapsulated app with its own database and, eventually, its own public REST API. Design doc and discussion live in the Linear project (see CON-803).

One codebase, several processes. The role is picked at runtime:

```
INDEXER_ROLE = sync | backfill | api | jobs
NETWORK      = mainnet | sandbox | testnet
```

Currently implemented: `sync` (live tail with per-block atomic commits and a parent-hash continuity check), `backfill` (historical catch-up over an explicit height range), and a minimal `api` (healthz + status). `jobs` exits with `ROLE_NOT_IMPLEMENTED`.

## Scope

This app owns **chain-derived data only**: blocks, transactions, messages, on-chain provider/audit records, and the network aggregates computed from them. Off-chain provider data — pinging provider `/status` endpoints, provider inventory, uptime, IP geolocation, and the GPU breakdown derived from inventory — lives in `apps/provider-inventory`, not here. The one deliberate off-chain exception is **pricing** (AKT price history) plus **Keybase** validator identity, which the `jobs` role fetches because the daily USD aggregates and validator records need them; those enrich chain entities rather than providers.

Writers do not use leader election. Inserts are natural-keyed and conflict-ignoring and the `indexer_state` checkpoint only moves forward (`GREATEST` upsert), so overlapping writers on the same stream (e.g. two pods during a rolling deploy) duplicate work but cannot corrupt data or regress the checkpoint. Run one replica per writer role (`replicas: 1` for sync, `parallelism: 1` for backfill Jobs) to avoid the wasted work.

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

## Genesis import

Set `GENESIS_IMPORT=true` to seed genesis state before the first block: accounts, per-denom balances (as `genesis`-reason ledger entries), validators, and staking delegations, all in one transaction. Because balance history is only trustworthy from the network's genesis, a fresh `sync` with the flag on must begin at the genesis height, and a fresh start anywhere else is rejected with a clear error. On sandbox that height is 1 (`SYNC_START_HEIGHT=1`); the height is read from the genesis file itself, so a chain continued from an export uses its continuation height.

The import runs once. A `genesis` checkpoint in `indexer_state` makes a restart skip it, and the seed commits in a single transaction, so an interrupted run rolls back and retries cleanly. Genesis is fetched over RPC `/genesis_chunked` from the same nodes sync uses, and its `chain_id` must match the chain being indexed. Leave the flag unset (the default) and sync tails blocks, transactions, and messages from any height exactly as before.

## Backfill

The backfill role fills the database over an explicit, inclusive height range and exits when done, so it fits a one-off K8s Job:

```
INDEXER_ROLE=backfill
BACKFILL_FROM_HEIGHT=100000
BACKFILL_TO_HEIGHT=200000
```

Blocks are fetched from RPC in parallel (`BACKFILL_CONCURRENCY`, default 10) and committed strictly in order in batches of `BACKFILL_BATCH_SIZE` blocks (default 200), each batch in one Postgres transaction together with the checkpoint advance. Progress is checkpointed per range under the `indexer_state` stream `backfill:{from}-{to}`, so killing and restarting the job resumes at the checkpoint without gaps or duplicates, and re-running a completed range exits 0 immediately. Changing the range creates a fresh checkpoint row. All inserts are natural-keyed and conflict-ignoring, so a backfill can run against the same database as live sync, and a duplicate backfill pod on the same range is harmless.

## Raw block archive

Set `ARCHIVE_BUCKET` to a GCS bucket name to keep a zstd-compressed copy of every raw `/block` and `/block_results` payload, so handler fixes and new modules can be replayed without re-fetching history from RPC. Leave it unset and both roles behave exactly as before (the boot log says `ARCHIVE_DISABLED`). Authentication uses Application Default Credentials; no key material is configured in the app.

Live sync writes one staged object per block (`<chainId>/blocks/<height>.json.zst`) before the database commit, so a block is never committed without being archived. Backfill reads each height from the archive first: a 1,000-block chunk (`<chainId>/chunks/<start>-<end>.ndjson.zst`), then a staged single, then RPC as the last resort. Any pass over a fully covered aligned range compacts it into a chunk and deletes the staged singles it consumed. There is no separate compactor: replays and backfills compact as a side effect. Ranges that cannot complete a chunk (partial edges of the run) stay as staged singles until a later full-range pass heals them.

Two known gaps, both healable. Blocks are archived before the parent-hash continuity check, so a poisoned RPC node can pin a bad block for a height into the immutable archive even though sync halts and never commits it; a later replay of that range decodes the bad record and trips the same continuity check, which makes the divergence detectable, but the object has to be deleted by hand before a replay can archive the good copy. And a backfill killed mid-chunk loses that chunk's in-memory buffer: blocks committed before the kill are temporarily absent from the archive, and any later replay over the full range re-fetches them and compacts the chunk.

Chunk compaction writes the chunk before deleting the staged singles it consumed. This ordering never loses data — the chunk is authoritative and reads prefer it — but a crash landing between the two calls leaves those staged singles behind, and because a later read short-circuits on the now-existing chunk the delete never runs again for that range. The leftover objects are bounded (at most one chunk's worth per crash) and cost storage only; expire them with a GCS bucket lifecycle rule on the `<chainId>/blocks/` prefix rather than reordering the writes.

Object keys are namespaced by the chain id reported by RPC `/status` (e.g. `sandbox-2/...`), so a sandbox chain reset starts a fresh namespace instead of mixing archives. For local verification against an emulator such as fake-gcs-server, point `ARCHIVE_STORAGE_API_ENDPOINT` at it (e.g. `http://localhost:4443`); the SDK's `STORAGE_EMULATOR_HOST` variable does not work here because it switches the client to request paths the emulator rejects. If the archive is unavailable, sync retries and then halts rather than committing unarchived blocks, and a backfill Job fails so the scheduler can retry it.

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
