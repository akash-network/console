# Mainnet full backfill runbook

How to rebuild the chain-indexer database for `akashnet-2` from genesis, and how to prove the result before anything reads from it. The target from the design is a full rebuild in under 8 hours; the procedure below splits the work into a parallel archive build, one ordered database fill, and a verified handoff to live sync, so the ordered part is the only one that has to fit the budget.

## What the numbers look like

Measured on a laptop against a local Postgres, on 4,000 mainnet blocks near the tip (4.5 transactions per block on average, which is denser than the historical average):

| Stage                                         | Throughput    | Bound by             |
| --------------------------------------------- | ------------- | -------------------- |
| RPC-fed fetch over public nodes, 16 in flight | ~20 blocks/s  | the RPC nodes        |
| Archive-fed database fill                     | ~880 blocks/s | Postgres round trips |

The RPC pass is the one that cannot be tuned from this side: 28.8M blocks at 20 blocks/s is 400 hours. It is also the only pass that does not need ordering, which is why it runs as many Jobs at once (phase 1). The database fill at ~880 blocks/s on dense blocks, and faster on the sparse early years, is what has to land under 8 hours; phase 2 runs it once, in order, from the archive.

## Prerequisites

- Archive RPC nodes that serve `/block_results` for the whole history. This is the hard requirement, and as of 2026-09-26 no public mainnet node meets it: `rpc.akashnet.net` keeps results from ~28.48M, `akash-rpc.polkachu.com` and `rpc-akash.ecostake.com` keep every block but only ~340k blocks of results, and `akash-mainnet-rpc.cosmonautstakes.com` does not persist them at all. Line up at least two dedicated archive nodes (ideally in the same network as the Jobs) before starting, and point each phase-1 Job's `RPC_NODE_ENDPOINTS` at its own node so they do not compete.
- A GCS bucket for the archive (`ARCHIVE_BUCKET`), with Application Default Credentials on the Jobs. Budget roughly 3 to 5 KB per block compressed, so on the order of 100 GB for the whole chain. Add a lifecycle rule on the `<chainId>/blocks/` prefix so staged singles left by a crash between chunk write and single delete expire on their own.
- A Postgres with room for the estimated 90 to 140 GB, `max_connections` comfortably above 10 per writer, and `maintenance_work_mem` raised (2 GB or more) for the index rebuild at the end of phase 2.
- The mainnet genesis file on a volume reachable by the phase-2 Job (`GENESIS_FILE`). Fetching 11 MB through `/genesis_chunked` works too, but the file is simpler to reason about. Its `chain_id` must be `akashnet-2`.
- The chain tip at the start (`curl <rpc>/status | jq .result.sync_info.latest_block_height`). Call it `TIP`.

## Phase 1: build the archive in parallel

Every Job runs the backfill role with `BACKFILL_ARCHIVE_ONLY=true` over a disjoint range. Nothing is written to the database except an `archive:<from>-<to>` checkpoint, so the Jobs are independent and the ranges can be sized to the nodes available. Align ranges to 1,000-block chunk boundaries (`from` a multiple of 1,000, `to` one less than a multiple of 1,000) so no chunk straddles two Jobs; a straddled chunk is still correct, it just gets staged as singles and compacted later.

```
INDEXER_ROLE=backfill
NETWORK=mainnet
BACKFILL_ARCHIVE_ONLY=true
BACKFILL_FROM_HEIGHT=1
BACKFILL_TO_HEIGHT=4999999
BACKFILL_CONCURRENCY=32
RPC_NODE_ENDPOINTS=https://archive-node-a.example
ARCHIVE_BUCKET=<bucket>
POSTGRES_DB_URI=<same database as phase 2>
```

Run as a Kubernetes Job with `parallelism: 1` and `backoffLimit` high: a killed Job resumes from its checkpoint, which only advances at chunk boundaries, so a resume never leaves a hole. Raise `BACKFILL_CONCURRENCY` until the node's latency climbs; the archive writer does not care about ordering. The raw parent-hash chain is verified as blocks stream in (`ARCHIVE_CONTINUITY_BROKEN` halts the Job), and the ordered fill re-verifies every decoded block later.

Phase 1 is complete when every Job has logged `ARCHIVE_BUILD_COMPLETED` and the bucket holds `ceil((TIP) / 1000)` objects under `akashnet-2/chunks/`:

```bash
gcloud storage ls "gs://<bucket>/akashnet-2/chunks/" | wc -l
```

Blocks above `TIP` are picked up by live sync later; the archive keeps growing from the sync role's staged singles.

## Phase 2: fill the database in order

One Job, one range, from genesis to `TIP`, reading from the archive (RPC is only the fallback for a missing height):

```
INDEXER_ROLE=backfill
NETWORK=mainnet
GENESIS_IMPORT=true
GENESIS_FILE=/genesis/akashnet-2.json
BACKFILL_FROM_HEIGHT=1
BACKFILL_TO_HEIGHT=<TIP>
BACKFILL_DEFER_INDEXES=true
BACKFILL_BATCH_SIZE=200
BACKFILL_CONCURRENCY=32
ARCHIVE_BUCKET=<bucket>
RPC_NODE_ENDPOINTS=<archive node>
POSTGRES_DB_URI=<database>
```

What the flags do here:

- `GENESIS_IMPORT=true` seeds accounts, balances, validators and delegations before block 1. A range that does not start at the genesis height on an empty database is rejected, which is the guard against balances starting mid-chain.
- `BACKFILL_DEFER_INDEXES=true` drops the secondary indexes no writer needs (`INDEXES_DEFERRED` lists them) and records their definitions in `indexer_deferred_indexes`. The primary keys, unique indexes and the ledger's baseline index stay, because the writers depend on them.
- Batches of 200 blocks commit in one transaction each while the next batch is fetched and decoded; 1,000 measured within 2% of 200, so leave it unless memory is the constraint.

The Job logs `BACKFILL_PROGRESS` per batch. If it dies it resumes at its checkpoint; do not run two of these at once, the deployment, lease and balance state depends on strict height order. The range can be split into consecutive Jobs (1 to 10M, 10M+1 to 20M, ...) as long as each runs after the previous one completed and all of them keep `BACKFILL_DEFER_INDEXES=true`.

When `BACKFILL_COMPLETED` is logged, rebuild the indexes by running the backfill once more without the flag (any range, even an already complete one, restores before planning):

```
INDEXER_ROLE=backfill BACKFILL_FROM_HEIGHT=1 BACKFILL_TO_HEIGHT=<TIP>
```

Each rebuild logs `INDEX_RESTORING` and `INDEX_RESTORED` with its duration. The sync role does the same at boot, so skipping this step only moves the rebuild to the first sync start. `GET /v1/status` on any role reports `deferredIndexes`; it must be empty before phase 4.

Expect these warnings during the fill and nothing else at error level:

- `ACT_MIGRATION_DRAIN_SHORTFALL` must not appear on a genesis-to-tip fill. It is expected only on partial windows.
- `MESSAGES_DEAD_LETTERED` means the type catalog misses a message type. Register it and replay the range with `BACKFILL_REPLAY=true`; the fill itself continues.

## Phase 3: hand off to live sync

Start the sync role at the height right after the fill, with the flags that keep the guards on:

```
INDEXER_ROLE=sync
NETWORK=mainnet
GENESIS_IMPORT=true
SYNC_START_HEIGHT=<TIP + 1>
ARCHIVE_BUCKET=<bucket>
```

`GENESIS_IMPORT=true` is accepted because the genesis marker already exists. The sync seeds its parent-hash check from block `TIP`, so the first live block is verified against the last backfilled one (`CHAIN_CONTINUITY_BROKEN` halts it otherwise). Enable the staking snapshot as usual; it reconciles validators and delegations once sync reaches the tip.

Watch `indexer_sync_lag_seconds` fall to around one block time as sync catches up from the fill to the tip, and alert on it from then on (see the README's sync metrics section).

Then start the jobs role and seed the price history the rollups' USD depends on, since CoinGecko serves only the last year:

```
INDEXER_ROLE=jobs NETWORK=mainnet POSTGRES_DB_URI=<database>
LEGACY_POSTGRES_DB_URI=<legacy indexer database> npm run prices:seed-legacy
```

The seed logs `LEGACY_PRICES_SEEDED` with how many days it inserted and how many rollups it restated; the jobs role keeps the last year current from then on.

## Phase 4: parity gate A

The parity CLI runs the gate. Point it at the filled database, the legacy database, the legacy API and an api role serving the filled database, and pick a few fixed heights (spread over the chain's life) and busy addresses:

```bash
POSTGRES_DB_URI="$V2_URI" LEGACY_POSTGRES_DB_URI="$V1_URI" \
LEGACY_API_BASE_URL=https://console-api.akash.network PARITY_V2_API_BASE_URL=http://localhost:3092 \
RPC_NODE_ENDPOINTS=<archive node> RECONCILE_SAMPLE_SIZE=200 \
PARITY_HEIGHTS=1000000,5000000,10000000,15000000,20000000,25000000 PARITY_ADDRESSES=<comma-separated addresses> \
PARITY_OUTPUT=parity-gate-a.json npm run parity
```

It exits non-zero when any check fails. What each one proves is in the README's parity section; in short, `daily-counts` covers every block and transaction the two databases share, `active-sets` covers the akash lifecycle at the fixed heights, `balances` covers the ledger against the chain, and `http` covers the responses the delegation layer will switch over. A skipped part (the two tips differ, or a setting is missing) is not a pass: rerun until every part you rely on has compared something.

One set is not automated. A fresh genesis-to-tip fill must reproduce every provider the chain lists (2,051 at the time of writing) and the audit signatures, which closes the open question from the L-8 reconcile:

```bash
psql "$V2_URI" -Atc "SELECT count(*) FROM akash.providers WHERE deleted_height IS NULL"
akash query provider list --count-total --limit 1 -o json | jq -r .pagination.total
```

Record the checkpoint height, the report file, the provider count and the phase timings with the run.

### Cutover gate per endpoint

After the fill, enable the nightly workflow (`CHAIN_INDEXER_PARITY_ENABLED=true` with the same settings as repository secrets and variables). An endpoint moves behind its delegation flag only once its part of the `http` check, together with `daily-counts` and `balances`, has passed on seven consecutive nightly runs with nothing skipped. A failed night blocks the flag until the difference is explained and either fixed or accepted in writing on the cutover issue.

## Phase 5: replaying one module later

When a handler is fixed or a module gains a derived table after the cutover, replay just that module while sync keeps running:

1. Deploy the fixed version to the sync role first, so every block from now on carries the new rows.
2. Run one Job with `BACKFILL_MODULE=<module>`, `BACKFILL_RESET_MODULE=true` and `BACKFILL_FROM_HEIGHT` at the module's first height (1 for `akash`, `balance` with `GENESIS_IMPORT=true`, `provider`, `bme`; the first proposal's height is enough for `gov`). Leave `BACKFILL_TO_HEIGHT` unset: the replay hands off at the sync checkpoint.
3. Watch `REPLAY_STARTED`, then `REPLAY_PROGRESS` climbing to the head, then `REPLAY_COMPLETED` with `handoffHeight`. Sync's own `SYNC_PROGRESS` keeps ticking throughout; a full commit only skips the module under replay.
4. Verify with the parity gate for that module (the `reconcile` CLI for `balance`, the entity counts for `akash` and `provider`).

A killed replay Job resumes from its `replay:<module>` checkpoint on the next attempt. Never delete that row by hand: while it exists sync has skipped the module for every block it committed, and only the replay reaching the handoff fills those heights. A plain backfill refuses to start while a replay is in progress for the same reason.

## Troubleshooting

- `CHAIN_CONTINUITY_BROKEN` or `ARCHIVE_CONTINUITY_BROKEN`: a node served a block that does not chain. Check the height on a second node; if the archived copy is the bad one, delete `akashnet-2/chunks/<range>.ndjson.zst` (or the staged single) and re-run phase 1 for that range before resuming.
- Phase 2 much slower than the table above: check that `ARCHIVE_ENABLED` was logged at start and that RPC traffic is near zero; an archive miss falls back to RPC per block. Then look at Postgres: `pg_stat_activity` should show one writer connection busy in `INSERT` statements most of the time.
- `INDEXES_DEFERRED` logged by a run that was meant to rebuild: the flag is still set on that Job. Unset it and rerun; the restore is idempotent.
- A phase-1 Job with `RPC_NODE_FAILED` on `/block_results` and `height ... is not available`: the node prunes results. Only a true archive node works for phase 1.
