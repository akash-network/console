# Streamer-fed denormalised provider inventory for bid screening

Bid screening previously read the normalised legacy snapshot model (`provider`, `providerSnapshot`, `providerSnapshotNode*`, `providerSnapshotStorage`, `providerAttribute`, `providerAttributeSignature`) shared with stats / graphs / dashboards / GPU repo. The prefilter required a CTE with EXISTS subqueries plus a follow-up hydrate query plus a separate auditor-set query, all against tables sized for an append-only 15-minute history.

We are introducing `provider_inventory` — one row per provider, JSONB payload sized for the JS bin-packer plus plain rollup columns (`total_available_*`, `max_node_free_*`, `gpu_models`, `storage_classes`), plus two JSONB attribute columns (`self_attributes`, `signed_attributes`) and a denormalised `audited_by TEXT[]`. A new app, **`apps/provider-inventory`**, owns the table end-to-end: it runs a long-lived **streamer** that holds `streamStatus` gRPC connections to every active provider, diffs each incoming message against in-memory state, and writes changes via a single `UPDATE`; **and** it exposes the bid-screening HTTP API as a reader. `apps/api` keeps the public `/v1/bid-screening` route as a thin proxy that forwards authenticated requests to the new app — no bid-screening domain code remains in `apps/api` after cutover. The new app runs as a single replica; bid-screening QPS fits comfortably alongside hundreds of streams in one event loop, and single-replica enforcement preserves the streamer's single-writer guarantee without leader election. The legacy snapshot tables remain untouched as the history store.

## Schema

```sql
CREATE TABLE provider_inventory (
  owner             TEXT PRIMARY KEY,
  host_uri          TEXT NOT NULL,
  ip_region         TEXT,
  uptime_7d         DOUBLE PRECISION,
  is_online         BOOLEAN NOT NULL DEFAULT false,
  is_online_since   TIMESTAMPTZ,

  inventory         JSONB NOT NULL DEFAULT '{}'::jsonb,
                    -- shape: { nodes: [...], storage: [...] } — for the JS bin-packer

  total_available_cpu        BIGINT NOT NULL DEFAULT 0,
  total_available_memory     BIGINT NOT NULL DEFAULT 0,
  total_available_gpu        BIGINT NOT NULL DEFAULT 0,
  total_available_eph        BIGINT NOT NULL DEFAULT 0,
  total_available_persistent BIGINT NOT NULL DEFAULT 0,
  max_node_free_cpu          BIGINT NOT NULL DEFAULT 0,
  max_node_free_memory       BIGINT NOT NULL DEFAULT 0,
  max_node_free_gpu          BIGINT NOT NULL DEFAULT 0,
  gpu_models                 TEXT[] NOT NULL DEFAULT '{}',
  storage_classes            TEXT[] NOT NULL DEFAULT '{}',

  self_attributes   JSONB  NOT NULL DEFAULT '[]'::jsonb,
                    -- [{"key":"<k>","value":"<v>"}, ...]
  signed_attributes JSONB  NOT NULL DEFAULT '[]'::jsonb,
                    -- [{"key":"<k>","value":"<v>","auditor":"<a>"}, ...]
  audited_by        TEXT[] NOT NULL DEFAULT '{}',

  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
) WITH (FILLFACTOR = 70);

CREATE INDEX idx_provider_inventory_online
  ON provider_inventory (owner)
  WHERE is_online AND is_online_since IS NOT NULL;
```

`FILLFACTOR = 70` reserves page-local space for HOT-update tuple versions. The single partial index is the only index because `is_online` flips rarely (3-strike rule), so high-frequency inventory updates touch no indexed column and qualify for HOT.

## Read path

The bid-screening prefilter collapses three legacy queries (`getCandidateOwners` + `getOnlineProvidersWithSnapshots` + `getAuditedProviderAddresses`) into one round-trip:

```sql
SELECT owner, host_uri, ip_region, uptime_7d, inventory,
       audited_by @> ARRAY[$AUDITOR] AS is_audited
FROM provider_inventory
WHERE is_online
  AND is_online_since IS NOT NULL
  AND total_available_cpu       >= $totalCpu
  AND total_available_memory    >= $totalMemory
  AND total_available_eph       >= $totalEph
  AND max_node_free_cpu         >= $maxPerReplicaCpu
  AND max_node_free_memory      >= $maxPerReplicaMemory
  -- conditional GPU / persistent / attribute / signedBy predicates
;
```

JSON containment / array operators handle the rest:

```sql
-- self-declared K=V
self_attributes @> '[{"key":"K","value":"V"}]'::jsonb

-- (K=V) signed by auditor X
signed_attributes @> '[{"key":"K","value":"V","auditor":"X"}]'::jsonb

-- audited by anyOf [X,Y]    →   audited_by && ARRAY['X','Y']
-- audited by allOf [X,Y]    →   audited_by @> ARRAY['X','Y']

-- glob on self-declared key   (SeqScan, no index)
EXISTS (
  SELECT 1 FROM jsonb_array_elements(self_attributes) e
  WHERE e->>'key' ~ '<regex>' AND e->>'value' = '<V>'
)
```

The candidate rows return with their full `inventory` JSONB; the JS bin-packer reads it directly. No second hydrate query.

## Write path

Streamer flow per provider (single Node process, single event loop):

1. Discovery loop polls the akash chain via the chain SDK's `Provider/Providers` query (provider list + self-declared attributes) and `Audit/AllProvidersAttributes` query (signed attributes). The loop is implemented with recursive `setTimeout` (not `setInterval`) so consecutive ticks never overlap under chain-RPC latency, and it runs **immediately on service boot** so the cold-start blackout window collapses to seconds rather than up to 10 min. Subsequent ticks re-arm 10 min after the previous tick completes. Dedupes by `hostUri`. The streamer never reads the legacy provider/attribute/signature tables.
2. Open `streamStatus` gRPC stream for each owned provider.
3. **First message after connect** triggers `projectRow(message)` → single `UPDATE` that sets `inventory`, all rollup columns, `is_online = true`, `is_online_since = now()`. The in-memory **diff cache** stores the projected row.
4. **Subsequent messages**: structurally compare against the diff cache; identical messages are dropped silently; differing messages flow through `projectRow` and a single `UPDATE`.
5. Stream errors trigger the **3-strike rule**. After three failed reconnects (~7-10 s), `UPDATE provider_inventory SET is_online = false, is_online_since = NULL WHERE owner = $1`. Backoff continues at slower cadence; on success, GOTO step 3.

Attribute columns (`self_attributes`, `signed_attributes`, `audited_by`) are not part of the stream payload. They are refreshed by the discovery loop from the chain `Provider/Providers` and `Audit/AllProvidersAttributes` query results and written in an `UPDATE` that touches only the attribute and `audited_by` columns. Inventory and rollup columns are left alone, which avoids races between attribute and inventory writes.

## Lifecycle scenarios

- **Cold boot.** Streamer starts → `UPDATE provider_inventory SET is_online_since = NULL` (drops every row from the prefilter index) → **online warm-up** fires `streamStatus` connections to every owner with `is_online = true` (cached host_uri) → **discovery loop fires immediately** in parallel (chain queries for providers + attributes) → the discovery tick sees warm-up owners already in the registry and only opens streams for the rest; hostUri-changed owners are `restart`'d, chain-absent owners are `stopAndDelete`'d → first message per provider re-asserts `is_online_since = now()`. Because warm-up's `lifecycle.start` calls reach the stream-connection semaphore before the discovery tick's chain RPC returns, the ~83 reachable providers acquire permits ahead of the ~1877 dead ones from chain — the prefilter index repopulates in seconds rather than minutes. The next discovery tick is scheduled 10 min after the first one finishes, via recursive `setTimeout`.
- **Stream disconnect.** Diff cache for that provider is cleared. Reconnect attempts: t=0, +1s, +2s, +4s (full jitter). After 3rd failure, `is_online = false, is_online_since = NULL`. Continued retries with cap ~5 min until success.
- **Reconnect after disconnect.** First message is full state — written through unconditionally because the diff cache was cleared. `is_online`/`is_online_since` flip back.
- **Provider hostUri changes** (`MsgUpdateProvider`). Discovery loop sees diff on next tick (≤10 min), closes old stream, opens new one against the new hostUri.
- **Provider deleted on chain.** Discovery loop sees the provider absent from the next `Provider/Providers` result, closes stream, deletes row from `provider_inventory`.
- **Two providers share hostUri.** Discovery loop dedupes by hostUri keeping the latest `createdHeight`. The "loser" has no row in `provider_inventory`; bid-screening cannot route to it.
- **Worker crash.** Rows persist with `is_online = true, is_online_since = <pre-crash time>` until restart. Cold-boot ritual nulls `is_online_since`, prefilter rejects them, no stale data is served.

## Migration plan

1. Scaffold `apps/provider-inventory` with Hono + tsyringe + Drizzle, `/healthz`, single-replica deploy/compose stanza, env loading, logger.
2. Land `provider_inventory` schema + Drizzle bindings + migrations in the new app.
3. Build the streamer (chain poller, discovery scheduler, lifecycle manager, diff cache, projectRow, reduceAttributes, writer) inside `apps/provider-inventory`. Deploy alongside the legacy 15-min poll; the legacy poll keeps writing the legacy snapshot tables, the streamer writes only `provider_inventory`.
4. Build the new bid-screening service + repository + HTTP route in `apps/provider-inventory` (libs and matcher copied/transplanted from `apps/api`). Integration test against real Postgres.
5. Wait for the streamer's first sweep to populate `provider_inventory` for all online providers.
6. Add a feature-flagged proxy handler in `apps/api` that forwards `/v1/bid-screening` to the new app. Default: legacy in-process path.
7. Add metrics: prefilter result count, prefilter→bin-packer success rate, lease success rate per row-age bucket, proxy round-trip latency.
8. Cutover: flip the feature flag in `apps/api` to use the proxy.
9. After a stabilisation window, delete the bid-screening service / repository / libs / controllers / routes / tests from `apps/api`.

## Considered options

- **Optimise the existing tables in place.** Rejected: changes the write pattern of a table backing daily-history graph queries; couples bid-screening read latency to history append rate.
- **Materialised view over existing tables.** Rejected: refresh latency is no better than the 15-min poll; doesn't address inventory staleness within a poll window.
- **Reduce the legacy poll interval to seconds.** Rejected: hammers provider HTTP/gRPC endpoints without solving the "row reflects last poll, not last state change" lag.
- **Replace the legacy snapshot tables.** Rejected: stats / graphs / dashboards / GPU repo all read them; would force a much wider change.
- **Piscina worker pool for streams.** Rejected: persistent gRPC streams are I/O-bound, not CPU-bound. One Node event loop holds hundreds of streams cheaply; Piscina is designed for short-lived jobs and would force misuse of "task forever owns this state" patterns.
- **Stage 1: populate `provider_inventory` from the existing 15-min poll, defer streaming.** Rejected: the long-term answer is streaming; an interim writer would be thrown away. Direct streaming from day one accepted on the team's conviction in `streamStatus` reliability.
- **Relational child tables (`provider_inventory_node`, `_node_gpu`, `_storage`, `_attribute`).** Rejected: the bin-packer needs the full per-provider state anyway, so a single-row JSONB read collapses the legacy two-trip pattern to one round-trip without losing fidelity. Per-provider write becomes a single UPDATE rather than orchestrated multi-table UPSERT/DELETE.
- **Generated columns projecting JSONB to typed rollup columns.** Rejected: the `derived` sub-blob inside JSONB existed only to feed the generated columns — circular. Plain columns set explicitly by `projectRow` give the same result with less PG-side machinery and easier schema migrations.
- **GIN index on `attributes` JSONB.** Rejected for v1: at hundreds of rows, SeqScan with per-row containment is sub-10 ms. Add only if measured. Glob/regex on attribute keys is unindexable here; revisit at 10× scale.
- **Per-key flat attribute structure** (`{ "<key>": { value, signed_by[] } }`). Rejected: assumes one value per `(provider, key)` and assumes auditors only sign the self-declared value, neither of which the legacy on-chain schema enforces.
- **Multi-process sharding by `hash(owner) % N`.** Deferred. Single process is enough for current provider count; multi-process becomes the upgrade path if measured uptime is insufficient.
- **Sort each poller batch by `is_online`.** Rejected: the chain poller yields 500-provider batches and each batch already fires streams concurrently, so an online owner late in batch 1 still queues behind dead owners early in batch 1. The semaphore-permit ordering doesn't change. Worth ~nothing in practice.
- **Buffer the full chain provider list, sort globally by `is_online`, then dispatch.** Rejected: gives up the streaming generator shape of `poll()` and adds one full chain-RPC RTT of pure delay before any stream opens — the very latency the **online warm-up** is designed to eliminate.
- **Biased priority queue inside the stream-connection semaphore.** Rejected as unnecessary machinery: the natural microtask ordering already gives the priority we want. **Online warm-up** fires `lifecycle.start` for the known-online subset synchronously, so those streams reach `await semaphore.acquire()` before any chain-poll-discovered stream does (chain poll has to await an RPC). A second priority dimension inside the semaphore would duplicate the same ordering effect with more code.
- **Putting the bid-screening API in `apps/api` and the streamer in a separate app.** Rejected: the writer (streamer) and the reader (bid-screening repo) share the schema, the JSONB shapes, and the `ProviderWithSnapshot` hydration logic. Co-locating them in one process avoids cross-app type duplication, gives a single boundary for the eventual Go rewrite, and removes a network hop on the read path.
- **Putting the streamer in `apps/api` with a single-replica gate.** Rejected: `apps/api` is multi-replica; gating the streamer behind an env var creates a "magic pod" that's not interchangeable with the others, and breaks rolling deploys.
- **Putting the streamer in `apps/indexer`.** Considered: shares lifecycle pattern with the legacy 15-min provider poll. Rejected because the bid-screening reader (HTTP API) doesn't belong in `apps/indexer`, and splitting the new code across two apps duplicates types and adds a network hop.

## Consequences

- The streamer is the **single writer** to `provider_inventory`. Streamer death = up to ~10 s window of stale rows for active deployments. Mitigated by the **`is_online_since` startup ritual**: before opening any streams, the streamer runs `UPDATE provider_inventory SET is_online_since = NULL`, which empties the partial prefilter index until each stream's first message re-asserts liveness.
- The prefilter is **intentionally lossy**. The JS bin-packer is the strict check. False positives are acceptable; false negatives are bugs.
- **HOT updates are preserved.** The only index is partial on `WHERE is_online AND is_online_since IS NOT NULL`. `is_online` flips rarely (only on connect / 3-strike disconnect). High-frequency inventory updates touch no indexed column. `FILLFACTOR = 70` keeps page-local update space available.
- **TOAST behaviour.** Large per-provider inventories (many nodes + GPUs) push `inventory` JSONB into TOAST. TOAST has its own MVCC and vacuum; updates rewrite the TOAST tuple but do not break HOT in the heap. Acceptable at current scale.
- **JSONB `attributes` are not GIN-indexed.** At hundreds of providers, a SeqScan with per-row `@>` containment is sub-10 ms. Add GIN only if measured. Glob/regex on attribute keys falls back to SeqScan; revisit at 10× provider count.
- **`is_online` semantics differ from legacy `provider.isOnline`** (see CONTEXT.md). Two systems, two truths, by design.
- **One value per `(owner, key)` is _not_ assumed.** Both `self_attributes` and `signed_attributes` are arrays of facts, faithful to the legacy on-chain schema where multiple values per key and disagreeing auditors are permitted.
- **Stream protocol risk.** Providers that don't implement `streamStatus` per the assumed contract (emit on state change, full state per message, send current state on connection) will be classified `is_online = false` after the 3-strike rule, identical to truly offline providers. Acceptable exposure.
- **Discovery latency.** New providers and hostUri changes propagate at the discovery loop cadence (10 min). Acceptable because chain-level provider events are rare.
- **Single point of failure.** No multi-process sharding for v1. HA via in-process retries only. Multi-process partitioning by `hash(owner) % N` is the upgrade path if measured uptime is insufficient.
- **Audit/attribute write conflict.** The streamer is also the writer for attribute columns, refreshed during the discovery loop. The discovery-loop UPDATE must merge with the most recent inventory rather than overwriting it — implemented by reading the row first or by writing only the attribute / `audited_by` columns.
- **`apps/api` becomes a thin proxy for bid screening.** The public route stays in `apps/api`; its handler validates auth, forwards user context as headers, makes an internal HTTP call to `apps/provider-inventory`, returns the response. After cutover, `apps/api` carries zero bid-screening domain code. Future Go rewrite replaces `apps/provider-inventory` wholesale; `apps/api`'s proxy handler is unchanged by the rewrite.
- **Single replica, both writer and reader.** `apps/provider-inventory` is single-replica; bid-screening QPS (one per deployment creation) fits in one event loop alongside hundreds of streams. Horizontal scaling for the read path is deferred to the Go rewrite.
