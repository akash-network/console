# PRD — Streamer-fed provider inventory for bid screening

> Companion documents:
> - [CONTEXT.md](../CONTEXT.md) — domain language and relationships
> - [ADR 0001](./adr/0001-streamer-fed-provider-inventory.md) — design decision and trade-offs

## Problem Statement

When a deployment owner submits a **GroupSpec** through the Console, bid screening must surface only the providers that have a realistic chance of fulfilling it. Today the prefilter runs against the legacy `providerSnapshot` family of tables, which are append-only history tables refreshed by a 15-minute HTTP poll across every provider. Three problems flow from that:

- **Stale inventory.** A provider may have accepted multiple leases minutes ago and have no real capacity left, yet still appear as a candidate for up to 15 minutes. The user submits a deployment, the provider doesn't bid back, and the user has no signal that they wasted their time.
- **Slow read path.** The legacy prefilter is a CTE with EXISTS subqueries against per-node history rows, plus a follow-up hydrate query that joins five tables, plus a third query for the auditor set. Three round-trips per request, all against tables sized for history rather than live state.
- **Coupling.** The same tables back daily uptime graphs, dashboards, and the GPU repository. Any optimisation aimed at bid screening risks regressing the others.

## Solution

Bid screening becomes the consumer of a new `provider_inventory` read model that always reflects each provider's *current* cluster state, sourced from a long-lived gRPC `streamStatus` connection per provider. The legacy snapshot tables remain untouched as the history store for graphs and dashboards.

The new model is owned end-to-end by a new app, **`apps/provider-inventory`**, which contains both the writer (streamer + chain discovery loop) and the reader (bid-screening HTTP API). `apps/api` keeps its public `/v1/bid-screening` route as a thin proxy that forwards authenticated requests to the new app — no bid-screening domain logic remains in `apps/api` after cutover. The new app exposes `/healthz` for k8s probes and runs as a single replica because it owns the streamer's single-writer guarantee.

From the user's point of view: when they submit a GroupSpec, the candidate list reflects whatever the provider's cluster looked like seconds ago — not minutes. Providers that just got fully booked drop out. Providers that just freed up capacity reappear. The list itself returns faster because there's only one round-trip and one row per candidate, with the bin-packer payload already carried in JSONB.

## User Stories

1. As an Akash deployment owner, I want the list of bidding providers to reflect each provider's real available capacity, so that I do not waste time deploying to providers that just got fully booked.
2. As an Akash deployment owner, I want bid-screening responses to be fast, so that the deployment flow does not stall.
3. As an Akash deployment owner, I want providers that match my GPU vendor and model requirement to be surfaced, so that my workload runs on suitable hardware.
4. As an Akash deployment owner, I want providers that match my persistent storage class requirement to be surfaced, so that my data stays on the storage tier I asked for.
5. As an Akash deployment owner, I want providers signed by my listed auditors to be surfaced, so that I can trust attestations about the provider's identity and capabilities.
6. As an Akash deployment owner, I want providers with self-declared attributes that match my requirements (region, tier, etc.) to be surfaced, so that placement reflects my preferences.
7. As an Akash deployment owner, I want offline providers to be excluded from candidates, so that I do not deploy to a host that cannot accept the lease.
8. As an Akash deployment owner, I want providers that recently went offline to drop out within seconds, so that I am not shown a stale candidate.
9. As an Akash deployment owner, I want providers that recently came back online to be included as candidates promptly, so that available capacity is not under-reported.
10. As an Akash deployment owner, I want bid screening to clearly mark providers audited by the platform's known auditor, so that I can identify trusted candidates at a glance.
11. As an Akash deployment owner submitting a multi-replica GroupSpec, I want the prefilter to reject providers that obviously lack capacity for any single replica, so that infeasible candidates are filtered before I review them.
12. As an Akash deployment owner submitting a deployment with mixed resource units (different replica shapes), I want the prefilter to consider all units rather than just one, so that I am not shown providers that cannot host every unit.
13. As an Akash deployment owner, I want glob attribute matchers (e.g. `gpu/vendor/*`) to work, so that broad attribute requirements still find candidates.
14. As a Console developer, I want `provider_inventory` to be the only table the bid-screening repository reads, so that bid-screening latency is not coupled to history-table layout or cross-team write patterns.
15. As a Console developer, I want the bid-screening read path to be a single SQL round-trip, so that response latency is predictable and easy to reason about.
16. As a Console developer, I want the bin-packer's input shape to be the same as today, so that the matcher service does not change.
17. As a Console developer, I want clear separation between the legacy snapshot pipeline and the new streamer pipeline, so that one's failures do not affect the other.
18. As a Console developer, I want the streamer's diff cache to suppress no-op writes, so that DB write rate tracks real change rate, not message rate.
19. As a Console developer, I want the streamer to write only via a single `projectRow` mapping function, so that there is one obvious place to evolve the row contract.
20. As a Console developer, I want HOT updates to be preserved on the high-churn parent row, so that table bloat stays bounded without aggressive autovacuum tuning.
21. As a Console developer, I want the pre-existing legacy snapshot tables and their consumers to keep working unchanged, so that history graphs, dashboards, and the GPU repository are not regressed.
22. As an operator running the streamer, I want a single Node process to hold all provider streams, so that the runtime footprint is small and operationally simple.
23. As an operator running the streamer, I want stream disconnects to be handled with bounded exponential-backoff retries, so that transient network issues do not flap providers offline and back.
24. As an operator running the streamer, I want providers that fail three reconnect attempts to be marked offline immediately, so that bid screening stops returning them as candidates.
25. As an operator running the streamer, I want the streamer to keep retrying disconnected providers indefinitely with a longer cap, so that providers that come back online are picked up automatically.
26. As an operator running the streamer, I want a startup ritual that prevents stale rows from being trusted after a streamer crash, so that bid-screening responses are not built on pre-crash data.
27. As an operator running the streamer, I want logs and metrics on stream lifecycle events (connect, disconnect, retry, give-up), so that I can debug provider-side issues.
28. As an operator running the streamer, I want metrics on diff-cache hit rate, so that I can verify the no-op suppression is effective.
29. As an operator running the streamer, I want metrics on row update rate per provider, so that I can spot pathological providers that emit excessive traffic.
30. As an operator running the streamer, I want graceful shutdown that closes streams cleanly, so that providers do not see abrupt disconnects on deploys.
31. As an operator running the streamer, I want a failed discovery-loop chain poll to be retried on the next tick without crashing the streamer, so that a temporary chain RPC outage does not interrupt the live `streamStatus` connections that are still healthy.
32. As an operator running the streamer, I want the discovery loop to dedupe providers that share a hostUri, so that we do not open redundant streams to the same physical endpoint.
33. As an Akash provider operator, I want the streamer's reconnection cadence to be reasonable, so that my gRPC endpoint is not hammered by retries during transient downtime.
34. As an auditor, I want my signatures to surface in `audited_by` within one discovery-loop cycle (≤10 min), so that providers I have signed are reflected in deployment owners' filters with bounded lag.
35. As a Console developer reviewing a bid-screening PR, I want the prefilter SQL to be obvious and indexable, so that performance regressions are easy to spot.
36. As a Console developer adding a new resource dimension in the future (say "FPGA"), I want the rollup-column pattern to be the obvious extension point, so that I know where to add it.
37. As a Console developer, I want `provider_inventory` to live in the shared database package alongside the legacy schemas, so that schema migrations follow the existing flow.
38. As a Console developer, I want the bid-screening integration test to exercise the new prefilter against a real Postgres, so that JSONB-containment and array-operator behaviour is validated end-to-end.
39. As an Akash deployment owner whose GroupSpec mixes ephemeral and persistent storage, I want both classes to be considered correctly in the prefilter, so that valid providers are not excluded.
40. As an Akash deployment owner whose GroupSpec uses RAM-backed storage, I want it to consume the provider's memory budget rather than ephemeral or persistent pools, so that the prefilter is dimensionally correct.
41. As an Akash deployment owner, I want providers with disagreeing self-declared and signed attribute values to be filtered faithfully (signed-only filters consult signed attributes, self-only filters consult self-declared), so that the prefilter respects the on-chain truth even in edge cases.
42. As a Console developer, I want the streamer (writer) and the bid-screening API (reader) to live in the same process, so that they share types and the read-path code is colocated with the data it depends on.
43. As a Console developer, I want `apps/api` to keep zero bid-screening domain code after cutover, so that `apps/api` stays focused on its public-API gateway role and the bid-screening service has a clean boundary for the eventual Go rewrite.
44. As an operator, I want the new app to expose a `/healthz` endpoint, so that k8s liveness and readiness probes can detect failures.
45. As an operator, I want `apps/api` to surface a clear error when the bid-screening backend is unreachable, so that bid-screening outages are not silently masked or replaced with empty candidate lists.
46. As an operator, I want the new app to run as a single replica enforced at the deployment topology level, so that the streamer's single-writer guarantee holds without leader-election machinery.
47. As an operator, I want the bid-screening proxy in `apps/api` to be feature-flagged at cutover, so that we can revert to the legacy in-process bid-screening path quickly if a regression appears.

## Implementation Decisions

### Architecture

- A new app, **`apps/provider-inventory`**, owns the entire bid-screening domain end-to-end: the streamer (writer to `provider_inventory`), the chain discovery loop, the bid-screening HTTP API (reader), and a `/healthz` probe endpoint.
- The new app runs as a **single Node process, single replica**. Single replica is enforced by the k8s/compose deployment topology, not by code, so the streamer's single-writer guarantee holds without leader election. Bid-screening QPS (one request per deployment creation) fits comfortably alongside hundreds of streams in one event loop.
- The **streamer** owns one `streamStatus` gRPC connection per active provider. No worker threads. HA via in-process retries; multi-process sharding is deferred.
- The streamer is the **only writer** to `provider_inventory`.
- The streamer ingests provider/attribute/signature state by **polling the chain** via the akash chain SDK's `akash.provider.v1beta4.Query/Providers` (provider list + self-declared attributes) and `akash.audit.v1.Query/AllProvidersAttributes` (signed attributes). The discovery loop runs **immediately on service boot** (not after a wait), then re-arms itself with recursive `setTimeout` 10 min after each tick completes — never `setInterval`, so consecutive ticks cannot overlap under chain-RPC latency. The streamer does **not** read the legacy `provider`, `providerAttribute`, or `providerAttributeSignature` tables.
- **`apps/api` becomes a thin proxy** for bid-screening. The public `/v1/bid-screening` route stays in `apps/api`; its handler validates auth, forwards the request body to the new app over an internal HTTP call, and returns the response. After cutover, `apps/api` carries zero bid-screening domain code (no service, no repository, no libs, no schemas, no tests).
- The legacy 15-min poll in `apps/indexer` is unchanged. The legacy snapshot tables coexist and continue to serve graphs / dashboards / GPU repo.
- Same framework stack as `apps/api`: Hono + `@hono/zod-openapi`, tsyringe, Drizzle, Pino-based `LoggerService`, Zod, Vitest, env-loader. Reuses `OpenApiHonoHandler`, `createRoute`, and the project's testing patterns from CLAUDE.md.

### Data model

- `provider_inventory` is a single-row-per-provider table.
- The full bin-packer payload (nodes + per-node CPU/GPU/memory/ephemeral allocation, storage pools) is stored as a JSONB `inventory` column.
- Plain rollup columns (`total_available_*`, `max_node_free_*`, `gpu_models TEXT[]`, `storage_classes TEXT[]`) are written by the streamer in the same `UPDATE` as `inventory`. They feed the SQL prefilter.
- Self-declared and signed attributes are stored as **two separate JSONB array columns**: `self_attributes` (`[{key, value}]`) and `signed_attributes` (`[{key, value, auditor}]`). The legacy schema permits multiple values per `(owner, key)` and disagreeing auditors; the array shape preserves that fidelity.
- A denormalised `audited_by TEXT[]` carries the union of all auditors that have signed any attribute on a provider, for the cheap "audited by AUDITOR" path.
- `is_online BOOLEAN` is owned by the streamer's stream lifecycle (connect / 3-strike / disconnect).
- `is_online_since TIMESTAMPTZ` is set to `now()` on stream-becomes-live and cleared on disconnect. Its purpose is to gate the prefilter index against rows written by a previous streamer generation.
- The single index is partial, on `(owner) WHERE is_online AND is_online_since IS NOT NULL`. No GIN. Default `FILLFACTOR = 70`.
- The schema lives in `packages/database` alongside legacy schemas. Drizzle bindings. Migrations are run by `apps/provider-inventory`'s `migration:exec` script.

### Modules in `apps/provider-inventory`

| Module | Responsibility | Deep? |
|---|---|---|
| `ChainProviderPoller` | Polls the akash chain via the chain SDK's `Provider/Providers` and `Audit/AllProvidersAttributes` queries. Returns a normalised snapshot of `(owner, hostUri, createdHeight, selfAttributes, signedAttributes)` records. Stateless — diffing happens downstream. Caller is responsible for the loop cadence; the poller itself is a single-call function. | Yes |
| Discovery scheduler | Wires `ChainProviderPoller` → `DiscoveryReconciler` → `StreamLifecycleManager`. Runs the first tick immediately on boot, schedules subsequent ticks via recursive `setTimeout` 10 min after each tick completes. Catches and logs poll failures without breaking the schedule. | Shallow |
| `DiscoveryReconciler` | Pure function `(currentRegistry, latestProviderState) → { toStart, toStop, toRestart, toUpdateAttributes }`. Dedupes providers sharing a hostUri (latest `createdHeight` wins). | Yes |
| `StreamLifecycleManager` | Owns `Map<owner, StreamHandle>`. State machine: connecting → live → disconnected → retrying → offline. Implements the 3-strike rule (~7-10s) and the indefinite slow-retry tail. Holds the in-memory diff cache per stream. | Yes |
| `projectRow` | Pure function: `(streamMessage) → { inventory JSONB, total_available_*, max_node_free_*, gpu_models, storage_classes }`. | Yes |
| `computeRollups` | Pure function: `(inventory) → rollups`. Sub-component of projectRow, isolatable for testing. | Yes |
| `reduceAttributes` | Pure function: `(selfFacts, signedFacts) → { self_attributes, signed_attributes, audited_by }`. | Yes |
| `ProviderInventoryWriter` | Thin wrapper around the single `UPDATE` statement; also performs the startup `is_online_since = NULL` ritual. | Shallow |
| `BidScreeningRepository` | New implementation reading `provider_inventory` exclusively (no legacy joins). Single round-trip query, hydrates JSONB into the existing `ProviderWithSnapshot`-shaped object for the bin-packer. | Yes |
| `BidScreeningService` | Orchestrates request validation → repository read → matcher. Moved from `apps/api`. | Shallow |
| `ClusterInventoryMatcherService` and the matcher libs (`groupspec-mapper`, `resource-aggregator`, `gpu-attribute-parser`, `storage-attribute-parser`, `inventory-mapper`, `resource-pair`) | Moved unchanged from `apps/api`. | Yes (already pure) |
| `POST /v1/bid-screening` route | Hono + `@hono/zod-openapi`. Same request/response contract as the existing route in `apps/api`. Trusts user-context headers set by the proxy in `apps/api`. | Shallow |
| `GET /healthz` | k8s liveness/readiness probe. Returns OK if process is alive and DB ping succeeds. | Shallow |
| Bootstrap orchestrator | Wires the modules together; runs the startup ritual, schedules the discovery loop, starts the lifecycle manager, starts the HTTP server. | Shallow |

### Modules in `apps/api`

| Module | Responsibility |
|---|---|
| Bid-screening proxy handler | Replaces the existing in-process bid-screening service. Validates auth, forwards user context as headers, makes an internal HTTP call to `apps/provider-inventory`'s `/v1/bid-screening`, returns the response. Behind a feature flag at first; legacy in-process path remains until cutover. |
| Bid-screening domain code | **Removed** after cutover (services, repositories, libs, schemas, controllers, tests). |

### Stream lifecycle (locked-in semantics)

- **First message after connect** triggers an `UPDATE` setting the full row plus `is_online = true, is_online_since = now()`. Stream-handshake-without-message does **not** flip `is_online`. If no message arrives within ~10s of handshake, treat as connect failure.
- **Subsequent messages** are diffed against the in-memory cache; identical messages are dropped silently.
- **Disconnect** clears the in-memory diff cache for that provider. After 3 reconnect failures (1s, 2s, 4s with full jitter), set `is_online = false, is_online_since = NULL`. Continue retrying with a longer cap (~5 min).
- **HostUri change.** When a discovery-loop tick reports a different `hostUri` for the same `owner`, the old stream is closed and a new one is opened against the new endpoint.
- **Provider deletion.** When a discovery-loop tick no longer returns a previously known `owner`, the streamer closes the stream and removes the row from `provider_inventory`.

### Read path (locked-in)

- Bid screening reads `provider_inventory` only — never legacy tables.
- One SQL round-trip filters on `is_online AND is_online_since IS NOT NULL` plus the prefilter predicates and returns each candidate's `inventory` JSONB plus `is_audited` (precomputed via `audited_by @> ARRAY[$AUDITOR]`).
- The bin-packer continues to consume the same `ProviderWithSnapshot`-shaped object; the repository hydrates it from the JSONB.

### Attribute write path (locked-in)

- Each discovery-loop tick passes the chain query results through `reduceAttributes` and issues a per-provider UPDATE that touches **only** `self_attributes`, `signed_attributes`, `audited_by`, and `updated_at` — leaving `inventory` and rollup columns alone. This avoids attribute-update vs inventory-update races.

### What stays unchanged

- `ClusterInventoryMatcherService` and its data-shape contract.
- Legacy `apps/indexer` and the `providerSnapshot*` tables.
- Any non-bid-screening reader of legacy provider data.

## Testing Decisions

### What makes a good test here

- Tests should describe **observable behaviour**, not implementation steps. A test for `projectRow` should describe input → expected row, not "calls computeRollups internally".
- Use the project's `setup()` convention rather than `beforeEach` — see CLAUDE.md and the prior-art tests.
- For modules that depend on gRPC or chain SDK, prefer `mock<T>()` over hand-rolled `as unknown as` casts (per project convention).

### Modules with unit tests

- **`projectRow`** — table-driven cases over the full stream-message → row mapping. Cover: empty cluster, single-node cluster, multi-node, mixed GPU vendors, ephemeral-only and persistent-only and mixed storage, RAM storage class, providers with no GPUs, providers with no nodes.
- **`computeRollups`** — boundary cases: max-node-free vs total-available, GPU models deduplication, storage class set, all-zero capacity, overcommit handling (negative free clamped to zero).
- **`reduceAttributes`** — multi-auditor signing the same attribute, auditors signing values that disagree with self-declared, missing self-declared but present signature, missing signature but present self-declared, audited_by union correctness.
- **`StreamLifecycleManager`** — state-machine transitions exercised against a fake gRPC client. Cover: first-message-becomes-live, identical-message-skipped, divergent-message-writes, three-strike-flips-offline, reconnect-resets-diff-cache, hostUri-change-restart, graceful-shutdown.
- **`DiscoveryReconciler`** — diff outputs for: brand-new provider, deleted provider, hostUri-changed provider, two providers sharing hostUri (latest wins), no-op tick.

### Modules with integration tests

- **`BidScreeningRepository`** — full prefilter behaviour against a real Postgres. Cover: aggregate filters (CPU/memory/GPU/ephemeral/persistent), per-node max-free filters, GPU vendor/model match, persistent storage class match, self-attribute exact match, self-attribute glob match, signedBy anyOf, signedBy allOf, audited-by precompute, offline filter, `is_online_since` filter, multi-resource-unit GroupSpec aggregation. Models and extends the prior art at the existing `bid-screening.repository.integration.ts`.

### Skipped on purpose

- `ProviderInventoryWriter` (single-statement wrapper) and the bootstrap orchestrator are pass-through code; their behaviour is exercised through the integration test and the lifecycle-manager unit tests.
- `ChainProviderPoller` is heavily I/O-bound on a third-party SDK; covered by manual smoke tests and runtime metrics rather than unit tests.
- The bid-screening proxy handler in `apps/api` is a thin HTTP forwarder; covered by an end-to-end test that hits `apps/api`'s public route and asserts the response from `apps/provider-inventory` is returned faithfully.

## Out of Scope

- Replacing or removing the legacy `providerSnapshot` family of tables.
- Changing daily-history graphs, dashboards, or the GPU repository to read from `provider_inventory`.
- Multi-process sharding of the streamer for HA. Single process, in-process retries only. The upgrade path (`hash(owner) % N` partitioning, lease coordination) is acknowledged but not built.
- GIN indexing of `self_attributes` / `signed_attributes`. Defer until measured.
- Materialised view alternatives.
- A worker pool (Piscina or otherwise). Single event loop is adequate.
- Generated columns projecting JSONB to typed rollups. Plain columns written by the writer.
- A "warm" migration that backfills `provider_inventory` from the legacy poll. The streamer's first sweep populates the table.
- Removing the legacy bid-screening repository code. Switch consumers first; clean up later.

## Further Notes

- The migration plan: scaffold `apps/provider-inventory` with `/healthz` → land schema → build streamer → build new bid-screening service + HTTP route in the new app → add proxy in `apps/api` behind feature flag → wait for streamer's first sweep to populate `provider_inventory` → flip the feature flag → remove legacy bid-screening code from `apps/api`.
- Suggested metrics to add at cutover: prefilter result count, prefilter→bin-packer success rate, lease success rate per row-age bucket, streamer connect/disconnect/strike counts per provider, diff-cache hit rate, bid-screening request latency from `apps/api`'s perspective (proxy round-trip).
- Risk: providers that don't implement `streamStatus` per the assumed contract (emit on state change, full state per message, send current state on connection) will remain `is_online = false` after the 3-strike rule, identical to truly offline providers. We accept this exposure.
- Risk: duplicate chain ingest. The legacy indexer also reads provider/attribute state from chain. The streamer's poll is independent (separate RPC client, separate cadence) and will not interact with the legacy indexer's flow. The minor extra load on the chain RPC node is acceptable.
- Risk: `apps/provider-inventory` becomes a single point of failure for bid screening. Mitigated by `apps/api`'s proxy handler returning a clear error (not silent empty list) when the backend is unreachable, and by k8s health probes restarting the process on failure. Multi-process HA is deferred.
- Forward-compat: when the Go rewrite happens, it replaces `apps/provider-inventory` wholesale. The schema, JSONB shapes, `/v1/bid-screening` request/response contract, and `streamStatus` assumptions are the durable interfaces; the Go service inherits them. `apps/api`'s proxy handler is unchanged by the rewrite.
- Bid-screening domain language and decisions are documented in [CONTEXT.md](../CONTEXT.md) and [ADR 0001](./adr/0001-streamer-fed-provider-inventory.md). Use the same vocabulary in PR descriptions and follow-up tickets.
