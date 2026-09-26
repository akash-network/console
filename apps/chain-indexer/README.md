# Chain Indexer

Rewrite of the Akash blockchain indexer as an encapsulated app with its own database and, eventually, its own public REST API. Design doc and discussion live in the Linear project (see CON-803).

One codebase, several processes. The role is picked at runtime:

```
INDEXER_ROLE = sync | backfill | api | jobs
NETWORK      = mainnet | sandbox | testnet
```

All four roles are implemented: `sync` (live tail with per-block atomic commits and a parent-hash continuity check), `backfill` (historical catch-up over an explicit height range, an archive-only pass that fills the raw block archive, or a single-module replay), `api` (the read-only REST service below) and `jobs` (the scheduled side tasks below). The full mainnet procedure lives in [docs/mainnet-backfill-runbook.md](docs/mainnet-backfill-runbook.md).

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

## Public API

`INDEXER_ROLE=api` serves a stateless, read-only REST API over the indexed data, documented at `GET /v1/doc` (OpenAPI 3.0). Any number of replicas can run; none of them writes. The query routes are mounted on the api role only; a sync, backfill or jobs process serves just `/healthz` and `/v1/status`, so a heavy query can never land on the writer's connection pool. The first endpoints target the worst offenders of the legacy API:

| Endpoint                                                   | Serves                                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET /v1/blocks?limit=20`                                  | The most recent blocks with their proposer resolved to a validator                                   |
| `GET /v1/blocks/{height}`                                  | One block with its transactions and their message types                                              |
| `GET /v1/addresses/{address}/transactions?skip=0&limit=20` | An address's transactions newest first, with the roles it played in each and the total               |
| `GET /v1/network-stats?days=30`                            | Active leases, resources and spend as of the last aggregated block, plus the most recent closed days |
| `GET /v1/status`                                           | Per-stream checkpoints, dead letters and deferred indexes                                            |

Address history reads the activity log, whose primary key `(account_id, height, tx_index, role)` lets one backward index scan order a page and fold the roles per transaction; the total is an index-only count over the same prefix. Blocks and transactions are primary-key lookups. Hashes are uppercase hex, and exact amounts (spend totals, fees) travel as strings.

The api role connects with `default_transaction_read_only` on and a per-statement timeout (`API_STATEMENT_TIMEOUT_MS`, default 30 s), whatever credentials it is given, and it never runs migrations: point `POSTGRES_DB_URI` at a read-only database role and deploy a writer role first. `SERVER_ORIGIN` is advertised as the server in the OpenAPI document.

Internal consumers get a typed client from the committed OpenAPI document. `npm run swagger:gen` rebuilds `swagger/openapi.json` from the routes, and `npm run generate:chain-indexer -w packages/console-api-types` regenerates the `@akashnetwork/console-api-types/chain-indexer` entry consumed through `@akashnetwork/openapi-sdk`:

```ts
import { createApi } from "@akashnetwork/openapi-sdk";
import { operations, type paths } from "@akashnetwork/console-api-types/chain-indexer";

const api = createApi<paths, typeof operations>(operations, { baseUrl: "https://chain-indexer.example" });
const { data } = await api.v1.listAddressTransactions({ address, skip: 0, limit: 20 });
```

## Jobs role

`INDEXER_ROLE=jobs` runs the two deliberate off-chain tasks on their own schedules, in their own process, so a slow scrape never delays ingestion:

- `price-history` (every `PRICE_SYNC_INTERVAL_MS`, default hourly) fetches CoinGecko's daily USD close for `PRICE_COINGECKO_ID` (default `akash-network`; set it empty to disable) over the last 360 days into `akash.daily_prices`, then restates `daily_usd_spent` on exactly the rollup days whose price moved.
- `keybase-identities` (every `KEYBASE_SYNC_INTERVAL_MS`, default six hours) resolves each validator's on-chain `identity` (a Keybase key suffix) to `keybase_username` and `keybase_avatar_url`, and clears both once the identity is removed, malformed or unknown to Keybase, so a rotated identity never keeps its old name. A failed lookup is logged and retried next run.

Each job runs one at a time: a tick that finds the previous run still going is skipped (`JOB_TICK_SKIPPED`), and a run past `JOB_TIMEOUT_MS` (default five minutes) is aborted and recorded as failed. Every run logs `JOB_STARTED` and `JOB_COMPLETED` or `JOB_FAILED` with its duration, increments the `indexer_job_runs_total` counter (by job and outcome) and records `indexer_job_duration_ms`, and updates `job_runs`, which `GET /v1/status` lists as `jobs` with the last status, error and counts. A failure to record an outcome (the `job_runs` write itself, failing or stalling past 30 s) is logged as `JOB_OBSERVER_FAILED` and never stops scheduling. On shutdown the scheduler gives in-flight runs ten seconds to finish, then aborts them and records them as failed with the shutdown as the error. A run that ignores its abort keeps the job's slot until it settles, so two runs of one job never overlap.

CoinGecko only serves about a year of daily prices, so daily USD before that comes from the legacy indexer's `day.aktPrice` history, imported once:

```bash
LEGACY_POSTGRES_DB_URI=postgres://... npm run prices:seed-legacy
```

The seed inserts the days `daily_prices` lacks, never overwrites a priced day, and restates the affected rollups; rerunning it is a no-op.

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

Blocks are fetched from RPC in parallel (`BACKFILL_CONCURRENCY`, default 10) and committed strictly in order in batches of `BACKFILL_BATCH_SIZE` blocks (default 200), each batch in one Postgres transaction together with the checkpoint advance. The next batch is fetched and decoded while the previous one commits, and the high-volume tables (blocks, transactions, messages, balance changes, account activity) are written as one `unnest` statement per table. Progress is checkpointed per range under the `indexer_state` stream `backfill:{from}-{to}`, so killing and restarting the job resumes at the checkpoint without gaps or duplicates, and re-running a completed range exits 0 immediately. Changing the range creates a fresh checkpoint row. All inserts are natural-keyed and conflict-ignoring, so a backfill can run against the same database as live sync, and a duplicate backfill pod on the same range is harmless.

With `GENESIS_IMPORT=true`, a fresh range starting at the genesis height seeds genesis before its first block, exactly as the sync role does; a range that starts elsewhere on an empty database is rejected. Once the genesis marker exists the flag can stay on for every later range and for the sync that takes over.

Two flags shape a full mainnet rebuild:

- `BACKFILL_ARCHIVE_ONLY=true` fetches the range into the raw block archive and commits nothing to the database (only an `archive:{from}-{to}` checkpoint, advanced at chunk boundaries). Because nothing is ordered, any number of these Jobs can run at once over disjoint ranges against different RPC nodes, which is how the one RPC-sourced pass over the chain is parallelized. Requires `ARCHIVE_BUCKET`.
- `BACKFILL_DEFER_INDEXES=true` drops the secondary indexes no writer consults (`transactions_hash_idx`, `messages_type_id_idx`, the deployment, lease and BME lookup indexes) before the run and leaves them dropped, recording their definitions in `indexer_deferred_indexes`. The first run without the flag, any backfill or the sync role, recreates them before doing anything else, so consecutive heavy ranges pay for the indexes once and no index can be forgotten. `GET /v1/status` lists whatever is still deferred.

A sync that starts fresh at a height the backfill reached seeds its parent-hash check from the block just below, so the handoff is verified like every other block.

## Module replay

A handler fix or a new derived table must not cost a full re-index or a sync pause. `BACKFILL_MODULE=<balance|gov|akash|provider|bme>` turns a backfill run into a replay of that one module from the raw block archive, under its own `replay:<module>` checkpoint, while live sync keeps the head fresh:

```
INDEXER_ROLE=backfill
BACKFILL_MODULE=akash
BACKFILL_RESET_MODULE=true
BACKFILL_FROM_HEIGHT=1
```

The `replay:<module>` row is both the replay's checkpoint and its ownership marker. Every full commit (sync, or a plain backfill) takes a short advisory lock, reads the markers, and leaves the marked modules to the replay while still writing the core tables and every other module, so sync is never interrupted. The replay catches up to the sync checkpoint in batches, and commits the batch that ends exactly there with the handoff flag: under the same lock it re-reads the checkpoint, and if sync has not moved it deletes the marker in the same transaction. Sync's next block then writes the module again. Every block below the handoff carries the replay's rows and every block above carries sync's, with no gap and no overlap; if sync did move, the replay simply continues to the new checkpoint and tries again. A killed replay resumes from its checkpoint, and a plain backfill refuses to start while a marker exists, because it would skip the module for every block it commits.

`BACKFILL_RESET_MODULE=true` empties the module's tables (identity sequences included) and its progress markers under the lock before the first block, so the rewrite starts from nothing the old handler wrote; two replays of the same range then produce identical rows. Without it the replay layers over the existing rows through the writers' own idempotency, which is enough for a fix that only adds rows. `akash` carries the network aggregates and the ACT migration with it (their markers and queue are reset together), and `balance` owns the genesis seed rows, so a balance replay from genesis runs with `GENESIS_IMPORT=true` and re-seeds before block 1. `BACKFILL_TO_HEIGHT` is required when no sync has ever run (the replay then completes on its own at that height, or follows the sync checkpoint and hands off there if sync starts meanwhile) and must be unset otherwise, since the only safe end is the sync checkpoint. A balance reset needs `GENESIS_IMPORT=true`, because the reset drops the genesis seed rows. While `provider` is under replay its table is being rebuilt, so live sync carries the last provider count forward in the network aggregates instead of counting it; a day closed in that window keeps that count, and an `akash` replay afterwards recomputes every rollup's provider count as of its close height. Progress is logged as `REPLAY_STARTED`, `REPLAY_PROGRESS` and `REPLAY_COMPLETED` with the handoff height, and `GET /v1/status` lists the `replay:` checkpoint while it runs.

## Proto type catalog and dead letters

Every message the decoder sees falls into one of three buckets, decided by `src/proto/type-catalog.ts`. Registered types decode to canonical JSON in `messages.body`; the catalog covers all Akash modules of the installed chain SDK plus the historical `v1beta1` through `v1beta4` versions from the frozen `@akashnetwork/akash-api` package, so mainnet history decodes too. Ignored types (each with a documented reason, e.g. cosmwasm on sandbox) store a null body and nothing else. Anything else is dead-lettered: the row in `messages` keeps its null body, and `message_dead_letters` records the raw bytes and the error, in the same transaction as the block, so ingestion never stalls on an unknown type. Each batch that dead-letters something logs a single `MESSAGES_DEAD_LETTERED` error with per-type counts, and `GET /v1/status` reports the store's totals; an alert can watch either signal.

A unit test (`src/proto/akash-type-coverage.spec.ts`) enumerates every Akash type in the installed chain SDK and fails when one is neither registered nor ignored, which keeps a dependency bump that ships new types from merging unhandled. When it fires, either add the module to the catalog or put the new types on the ignore list with a reason.

Dead letters heal by replay. Register the type (usually by bumping the SDK and updating the catalog), then re-run the backfill range with `BACKFILL_REPLAY=true`: the planner ignores the range's completed checkpoint, messages whose body was null get the decoded body on conflict, and each re-committed height clears its dead-letter rows. Rows that already had a body are left untouched, so a replay is cheap and idempotent. A writer that still fails to decode will not insert a dead letter for a message whose body is already set.

## Balance ledger and activity log

Every committed block also derives a balance ledger and an address activity log, in the same transaction as the block, so they never drift from the chain data they come from. `balance_changes` is the append-only ledger: one row per coin movement with the running `balance_after` and a classified `reason` (`mint`, `burn`, `slash`, `fee`, `reward`, `commission`, `staking`, `gov`, `ibc`, `escrow`, `bme`, or a plain `transfer`; genesis seeds are `genesis`). `account_balances` holds the current per-account per-denom balance, upserted from the ledger. `account_txs` is the activity log linking each account to the transactions that touched it. Addresses are interned to ids on first sight (`accounts`), so both live sync and backfill produce identical ledger rows for the same height.

The reason heuristic is deliberately MVP: coincident mint/burn/slash win first, then the module account on the holder's side of the movement (falling back to the counterparty's), then the denom. Per-deployment/lease attribution of escrow movements is left for later.

## ACT denom migration

The BME network upgrade converted every open escrow in place — axlUSDC to uact at par in the upgrade block itself, uakt to uact at the oracle AKT/USD rate over the following blocks — without emitting per-account events. The pipeline replays that conversion from what the blocks do show (`src/bme/act-migration.service.ts`): the first native `akash.bme.v1.*` event marks the upgrade block, where axlUSDC deployments convert and every open uakt deployment is queued in the chain's drain order (owner address, then dseq). Each later block whose BME module account burned uakt and minted uact was a drain block: queue entries are consumed in order, converting deployments, their open leases, open/active bids and open/paused group resource prices, until the computed totals equal the block's burn/mint events exactly. The rate is the latest `EventPriceData` from strictly earlier blocks, matching the one-block lag of the oracle's stored aggregate. Overshooting the block's totals aborts the commit — a wrong rate cannot corrupt silently — and running out of queue first logs `ACT_MIGRATION_DRAIN_SHORTFALL`, which is expected on partial-window backfills and a red flag on a full sync.

Both networks executed the migration in a single drain block, so the multi-block pacing is defensive rather than observed: v2.0.0 declares a 50-deployments-per-block cap but never increments its counter, and the whole queue drained at once. On mainnet the upgrade block is 26063777 (5,095.109965 axlUSDC converted at par) and the drain block is 26063781, which converted 9,663 deployments at the rate 0.584635140000000000 published at height 26063780. Replaying the queue reconstructed from historical chain state through this module's conversion math reproduces that block's burn of 44,862,222,630 uakt and mint of 26,228,026,358 uact to the exact uact, and only at that rate; the prices inside the drain block itself miss by tens of millions, which is the error the legacy indexer baked in.

Every step claims an `indexer_state` marker (`act-migration:upgrade`, `act-migration:drain:<height>`, `act-migration:drained`), so replays and overlapping writers skip already-applied steps. An `akash` module replay with `BACKFILL_RESET_MODULE=true` clears these markers and `act_migration_queue` along with the module's rows. Deliberate gaps, matching what the chain itself skipped or what this model does not track: deployments closed before their drain slot keep their creation-era denom (the chain skips them too), the chain's orphaned-escrow passes for closed deployments are not mirrored beyond open uusdc leases, a deployment open going into the upgrade block but closed by a transaction within that same block keeps its creation-era denom here (the chain converts it in the BeginBlocker before that transaction runs, so its final label is `uact` on chain — a par-rate relabel of an already-closed record, so balances are unaffected), and `deployments.deposit` scales by the rate as bookkeeping even though the chain keeps historical `transferred` entries in their original denom.

## Reconciliation

`npm run reconcile` proves the ledger matches the chain at the `sync` checkpoint height. It samples the highest-balance accounts, compares each against the node's bank balance at that height, and checks the ledger's per-denom totals against the chain's total supply; it exits non-zero on any mismatch or misconfiguration, so it can gate a deploy. Querying at the checkpoint rather than the moving tip keeps the comparison race-free, which requires an unpruned (archival) node — sandbox is archival. `RECONCILE_SAMPLE_SIZE` overrides the default sample of 100 accounts. While a `balance` replay owns the ledger (or an `akash` replay owns the network aggregates) the checkpoint no longer means those rows are complete, so the CLI reports `RECONCILE_MODULE_UNDER_REPLAY` and exits non-zero instead of comparing.

## Delegation from the legacy API

`apps/api` keeps serving its legacy chain endpoints unchanged while, one endpoint at a time, the data behind them comes from this indexer. Each endpoint has its own Unleash flag, so a cutover is a flag flip and a rollback is the same flip back; the legacy path stays in place until decommission. `apps/api` needs `CHAIN_INDEXER_API_BASE_URL` pointing at an api role; without it every flag is ignored, and a malformed value fails its boot. A delegated request gives up after `CHAIN_INDEXER_REQUEST_TIMEOUT_MS` (10 s by default), and a failed or timed-out delegated request falls back to the legacy data source (logged as `CHAIN_INDEXER_DELEGATION_FAILED`), so an unresponsive api role degrades instead of failing the endpoint.

| Legacy endpoint                                            | Flag                                 | Served from                                |
| ---------------------------------------------------------- | ------------------------------------ | ------------------------------------------ |
| `GET /v1/addresses/{address}/transactions/{skip}/{limit}`  | `chain_indexer_address_transactions` | `GET /v1/addresses/{address}/transactions` |
| `GET /v1/dashboard-data` (`now` and `compare` blocks only) | `chain_indexer_dashboard_stats`      | `GET /v1/network-stats`                    |

The adapters in `apps/api/src/chain-indexer` reduce this indexer's responses to the legacy shapes. Four things differ in content, not shape, and have to be accepted before a flag is flipped: address history lists transactions where the address only received coins (the legacy endpoint did not); `isReceiver` is set per transaction rather than per message, since this indexer records an address's roles per transaction; the memo, error log and per-message amounts are not stored here yet and come back empty (see CON-835); and the dashboard's USD totals are not exposed here yet and come back as zero (CON-1018). The dashboard's `compare` block is the day close nearest to 24 hours before the latest block rather than the first block after that instant.

## Parity

`npm run parity` compares this indexer with the legacy one and exits non-zero on any difference, so each endpoint's cutover can be gated on it (see the runbook's phase 4). `PARITY_CHECKS` selects which checks run; the default is all four.

| Check          | Compares                                                                                                | Needs                                           |
| -------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `daily-counts` | Per-UTC-day block and transaction counts over the heights both databases hold                           | `LEGACY_POSTGRES_DB_URI`                        |
| `active-sets`  | How many deployments, leases and providers were open at each `PARITY_HEIGHTS` height                    | `LEGACY_POSTGRES_DB_URI`, `PARITY_HEIGHTS`      |
| `balances`     | The reconcile check: sampled balances and the total supply against the chain at the sync checkpoint     | an archival node in `RPC_NODE_ENDPOINTS`        |
| `http`         | What the legacy Console API and the api role serve for the endpoints the delegation layer switches over | `LEGACY_API_BASE_URL`, `PARITY_V2_API_BASE_URL` |

The http check reduces both responses to the fields both sides serve before diffing them: block detail at each `PARITY_HEIGHTS` height (hash, time, gas, every transaction's hash, success and message types), the latest `PARITY_SAMPLE_LIMIT` blocks over the heights both lists share, each `PARITY_ADDRESSES` page aligned on the newest height both sides have indexed, and the live network stats only when both sides are at the same height. A part that cannot be compared because the two tips differ (including a fixed height neither side has reached) is reported as skipped, never as a failure; a part whose endpoint fails is reported as failed on its own line while the other parts still run. Address pages are matched by transaction hash, so a transaction present on one side only shows up once.

The report is logged as `PARITY_REPORT` and, when `PARITY_OUTPUT` is set, written there as JSON with one entry per check (`pass`, `fail` or `skipped`, a summary and up to the first differences). A nightly workflow (`.github/workflows/chain-indexer-parity.yml`) runs it once the `CHAIN_INDEXER_PARITY_ENABLED` repository variable is `true`; the connection settings come from repository secrets and variables, and the JSON is uploaded as the `parity-report` artifact of each run.

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

`npm test` runs the unit project and the integration project. Integration specs (`*.integration.ts`) create a migrated database per spec file on the Postgres at `POSTGRES_URI` (default `postgres://postgres:password@localhost:5432`); `npm run test:ci-setup` starts one with Docker when there is no local server.

## Schema changes

Edit `src/db/schema.ts`, then:

```bash
npm run migration:gen
```
