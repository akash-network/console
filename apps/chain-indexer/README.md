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

The import runs once. A `genesis` checkpoint in `indexer_state` makes a restart skip it, and the seed commits in a single transaction, so an interrupted run rolls back and retries cleanly. Genesis is fetched over RPC `/genesis_chunked` from the same nodes sync uses, unless `GENESIS_FILE` points at a local JSON file (the practical path for a large mainnet genesis). Either way its `chain_id` must match the chain being indexed. Leave the flag unset (the default) and sync tails blocks, transactions, and messages from any height exactly as before.

## Backfill

The backfill role fills the database over an explicit, inclusive height range and exits when done, so it fits a one-off K8s Job:

```
INDEXER_ROLE=backfill
BACKFILL_FROM_HEIGHT=100000
BACKFILL_TO_HEIGHT=200000
```

Blocks are fetched from RPC in parallel (`BACKFILL_CONCURRENCY`, default 10) and committed strictly in order in batches of `BACKFILL_BATCH_SIZE` blocks (default 200), each batch in one Postgres transaction together with the checkpoint advance. Progress is checkpointed per range under the `indexer_state` stream `backfill:{from}-{to}`, so killing and restarting the job resumes at the checkpoint without gaps or duplicates, and re-running a completed range exits 0 immediately. Changing the range creates a fresh checkpoint row. All inserts are natural-keyed and conflict-ignoring, so a backfill can run against the same database as live sync, and a duplicate backfill pod on the same range is harmless.

## Proto type catalog and dead letters

Every message the decoder sees falls into one of three buckets, decided by `src/proto/type-catalog.ts`. Registered types decode to canonical JSON in `messages.body`; the catalog covers all Akash modules of the installed chain SDK plus the historical `v1beta1` through `v1beta4` versions from the frozen `@akashnetwork/akash-api` package, so mainnet history decodes too. Ignored types (each with a documented reason, e.g. cosmwasm on sandbox) store a null body and nothing else. Anything else is dead-lettered: the row in `messages` keeps its null body, and `message_dead_letters` records the raw bytes and the error, in the same transaction as the block, so ingestion never stalls on an unknown type. Each batch that dead-letters something logs a single `MESSAGES_DEAD_LETTERED` error with per-type counts, and `GET /v1/status` reports the store's totals; an alert can watch either signal.

A unit test (`src/proto/akash-type-coverage.spec.ts`) enumerates every Akash type in the installed chain SDK and fails when one is neither registered nor ignored, which keeps a dependency bump that ships new types from merging unhandled. When it fires, either add the module to the catalog or put the new types on the ignore list with a reason.

Dead letters heal by replay. Register the type (usually by bumping the SDK and updating the catalog), then re-run the backfill range with `BACKFILL_REPLAY=true`: the planner ignores the range's completed checkpoint, messages whose body was null get the decoded body on conflict, and each re-committed height clears its dead-letter rows. Rows that already had a body are left untouched, so a replay is cheap and idempotent. A writer that still fails to decode will not insert a dead letter for a message whose body is already set.

## Balance ledger and activity log

Every committed block also derives a balance ledger and an address activity log, in the same transaction as the block, so they never drift from the chain data they come from. `balance_changes` is the append-only ledger: one row per coin movement with the running `balance_after` and a classified `reason` (`mint`, `burn`, `slash`, `fee`, `reward`, `commission`, `staking`, `gov`, `ibc`, `escrow`, `bme`, or a plain `transfer`; genesis seeds are `genesis`). `account_balances` holds the current per-account per-denom balance, upserted from the ledger. `account_txs` is the activity log linking each account to the transactions that touched it. Addresses are interned to ids on first sight (`accounts`), so both live sync and backfill produce identical ledger rows for the same height.

The reason heuristic is deliberately MVP: coincident mint/burn/slash win first, then the module account on the holder's side of the movement (falling back to the counterparty's), then the denom. Per-deployment/lease attribution of escrow movements is left for later.

## Reconciliation

`npm run reconcile` proves the ledger matches the chain at the `sync` checkpoint height. It samples the highest-balance accounts, compares each against the node's bank balance at that height, and checks the ledger's per-denom totals against the chain's total supply; it exits non-zero on any mismatch or misconfiguration, so it can gate a deploy. Querying at the checkpoint rather than the moving tip keeps the comparison race-free, which requires an unpruned (archival) node — sandbox is archival. `RECONCILE_SAMPLE_SIZE` overrides the default sample of 100 accounts.

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
