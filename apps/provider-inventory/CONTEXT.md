# Bid Screening

A read-side service that pre-filters Akash providers likely to satisfy a deployment's **GroupSpec**, before invoking the JS bin-packer. Optimised for low-latency reads of *current* provider state, not for storing on-chain history. Lives in **`apps/provider-inventory`** alongside the **streamer** that feeds it; `apps/api` retains the public route only as a thin **bid-screening proxy** to the new app.

## Language

### Providers and their state

**provider**:
An Akash entity that offers compute resources. Identified by **owner** address. Static-ish on-chain record (host URI, region, attributes).
_Avoid_: node, host, vendor

**provider inventory**:
Live cluster state for a provider — nodes, GPUs, storage pools, and their allocation. Reflects "what could be leased right now". Stored as one row per provider in `provider_inventory`.
_Avoid_: provider snapshot, current snapshot

**provider snapshot**:
The legacy append-only history written by the 15-min poll in `apps/indexer`. Powers daily uptime graphs, dashboards, and the GPU repo. **Not** read by bid screening.
_Avoid_: provider inventory

**node**:
A physical or virtual machine within a provider's cluster, with its own CPU/memory/ephemeral-storage capacity, its own GPU set, and its own ephemeral storage capabilities (HDD/SSD/NVMe). The bin-packer places replicas on individual nodes; cluster-aggregate capacity is not enough on its own to host a replica.
_Avoid_: machine, host, server

**ephemeral storage**:
Per-node scratch storage that disappears with the workload. Allocated against `nodeResources.ephemeralStorage`. Distinct from **persistent storage** which lives in cluster-wide pools.

**persistent storage**:
Cluster-wide storage pools identified by **storage class**. Each pool tracks `allocatable` and `allocated` independent of any node.

**storage class**:
A named pool of persistent storage on a provider (e.g. `beta1` for HDD, `beta2` for SSD, `beta3` for NVMe). `requirements.attributes.class` on a persistent volume must match a class the provider exposes.

**RAM storage class**:
A volume with `attributes.class = "ram"`. Allocated against node memory, not against ephemeral or persistent storage pools. **Persistent + RAM is invalid** and rejected by request validation.

### Requests

**GroupSpec**:
The user-supplied deployment requirement, originating from SDL. Carries `resources` (CPU, memory, GPU, storage per replica × count) and `requirements` (attribute constraints + auditor signers).
_Avoid_: deployment spec, manifest

**replica**:
A single instance of a service in a deployment. The **GroupSpec** lists resource units with `count` replicas each. The **bin-packer** must place every replica on some **node**.

**resource unit** / **group**:
One entry in **GroupSpec.resources**. A set of resources (CPU, memory, GPU, storage) requested for `count` replicas. All replicas in the same unit share the same resource shape; replicas in different units may have different shapes.

**glob attribute**:
A **GroupSpec.requirements.attributes** entry whose `key` contains `*` or `?`. Matched against provider attribute keys via PG regex (`~`). Works under SeqScan; not GIN-accelerated.

### Attributes and auditing

**self-attribute**:
A `(key, value)` declared by the provider on chain in `MsgUpdateProvider`. Stored as one element of `self_attributes JSONB` on `provider_inventory`. The same key may appear with multiple values.

**signed-attribute**:
A `(key, value, auditor)` written on chain when an auditor signs an attribute about a provider. Stored as one element of `signed_attributes JSONB`. Multiple auditors may sign the same `(key, value)`; auditors may also sign values that disagree with the provider's self-declaration.

**audited-by set**:
Denormalised union of all auditor addresses that have signed any attribute on a provider. `audited_by TEXT[]` on `provider_inventory`. Used for the cheap "is this provider audited by AUDITOR" path that bypasses unpacking `signed_attributes`.

**AUDITOR (constant)**:
A specific auditor address used by the application to mark "audited" providers in bid-screening result responses. Distinct from the user-supplied `requirements.signedBy` filter, which can list arbitrary auditors.

### Pipeline parts

**streamer**:
The component inside `apps/provider-inventory` that owns long-lived `streamStatus` gRPC connections to every active provider, diffs incoming messages against in-memory state, and writes changes to **provider inventory**. Runs in the same process as the **bid-screening API**; single replica, single writer to `provider_inventory`.
_Avoid_: collector, indexer, sync worker

**bid-screening proxy**:
The handler in `apps/api` that owns the public `/v1/bid-screening` route after cutover. Validates auth, forwards request body and user context to `apps/provider-inventory`'s `/v1/bid-screening`, returns the response. Carries no bid-screening domain code itself.
_Avoid_: bid-screening service (which lives in `apps/provider-inventory`), bid-screening client

**discovery loop**:
The streamer's polling loop that calls the akash chain SDK's `Provider/Providers` and `Audit/AllProvidersAttributes` queries to learn about new, removed, and renamed (hostUri-changed) providers and to refresh self- and signed-attributes. Runs immediately on service boot, then re-arms itself via recursive `setTimeout` every 10 min (self-pacing — never overlapping). Dedupes by `hostUri`, keeping the most recently created provider when two owners collide on the same hostUri. Independent of the legacy indexer's provider/attribute pipeline — does not read the legacy DB tables.

**3-strike rule**:
The streamer's reconnect policy — three exponential-backoff retries (~1 s, 2 s, 4 s, full jitter), then flip `is_online = false`. Reconnect attempts continue indefinitely afterward with a longer backoff (capped near 5 min).

**diff cache**:
Per-provider in-memory copy of the last successfully-applied state held by the streamer. Each incoming `streamStatus` message is compared against it; identical messages are silently dropped, divergent messages flow through **projectRow** to a single `UPDATE`. Reset to empty on every reconnect, so the first message after a reconnect always writes through.

**projectRow**:
Pure function `(streamMessage) → row`. Computes the rollup columns and denormalised `audited_by` from the streamed inventory, packs the bin-packer payload into `inventory` JSONB, and returns the full row to `UPDATE`. The single source of truth for how stream state maps to DB columns.

**rollup columns**:
Plain columns on `provider_inventory` (`total_available_*`, `max_node_free_*`, `gpu_models`, `storage_classes`) computed by the streamer from incoming inventory and written in the same `UPDATE` as the JSONB payload. They exist to keep the **prefilter** a single-table SeqScan.

**is_online_since startup ritual**:
The single `UPDATE provider_inventory SET is_online_since = NULL` the streamer issues before opening any streams on boot. Because the partial prefilter index is defined `WHERE is_online AND is_online_since IS NOT NULL`, this empties the index until each stream's first message reasserts liveness — preventing bid screening from trusting rows that may have gone stale during streamer downtime.

**online warm-up**:
A cold-boot-only step that runs after the **`is_online_since` startup ritual** and before the first **discovery loop** tick. Reads `WHERE is_online = true` from `provider_inventory` and fires `streamStatus` connections to those owners using their cached `host_uri`. Does not block on the connections settling — the discovery loop runs concurrently against fresh chain data and reconciles (restart on hostUri change, stopAndDelete on chain absence). Purpose is to collapse the prefilter blackout window: with ~1960 chain providers but only ~83 reachable, prioritising the known-online subset lets them acquire the stream-connection semaphore permits ahead of chain-poll-discovered dead providers, so the partial prefilter index repopulates in seconds rather than minutes. `is_online` is preserved across streamer restarts (only `is_online_since` is nulled by the ritual), so the read after the ritual is valid. No freshness filter on `is_online = true`: stale rows just fall through to the 3-strike rule like any unreachable provider — no regression vs. today.
_Avoid_: warm boot, online preflight, warm-start

**prefilter**:
The SQL stage that narrows the provider set on cluster aggregates and per-node max-free dimensions. Intentionally lossy — false positives flow through to the **bin-packer**; false negatives are bugs. One round-trip, one row per candidate, JSONB carries the bin-packer payload.

**bin-packer**:
The JS algorithm in `cluster-inventory-matcher.service.ts` that places replicas onto nodes greedily and decides whether the cluster can host the **GroupSpec**. The strict check.
_Avoid_: matcher, scheduler

## Relationships

- A **provider** has exactly one **provider inventory** row; the **streamer** is the only writer.
- A **provider inventory** row carries the full **bin-packer** payload (`inventory` JSONB) and **rollup columns** for the **prefilter**.
- A **provider inventory** row carries `self_attributes` and `signed_attributes` (denormalised from chain queries; see `discovery loop`) plus `audited_by`.
- Two **providers** with the same `hostUri` collapse into one stream connection (latest by `createdHeight` wins).
- The **prefilter** reads only `provider_inventory`; the legacy `provider*` tables are not joined.
- `apps/api` calls the **bid-screening proxy** for every `/v1/bid-screening` request; the proxy makes a single internal HTTP call to `apps/provider-inventory` and returns the response unchanged.
- The legacy **provider snapshot** tables coexist; readers other than bid screening still use them.

## Example dialogue

> **Engineer:** "If a provider goes offline mid-request, do we filter it out immediately?"
>
> **Domain expert:** "The **streamer** flips `is_online` to `false` after the **3-strike rule** completes (~7-10 s). The row stays. The **prefilter** filters by `is_online AND is_online_since IS NOT NULL`, so dead providers drop out without the row being deleted."
>
> **Engineer:** "And on streamer restart? The row's `is_online` may still claim true from before the crash."
>
> **Domain expert:** "That's what the **`is_online_since` startup ritual** handles. The streamer nulls `is_online_since` on every row before opening any streams. The prefilter index drops to zero rows. As streams reconnect, each first message resets `is_online_since = now()`. Healthy providers re-qualify within seconds; unreachable ones never do."
>
> **Engineer:** "So why don't we set `is_online = false` directly on startup instead of nulling a separate column?"
>
> **Domain expert:** "Because `is_online` is owned by the **3-strike rule** and represents a stream-local truth. The startup ritual is a *separate* invariant — 'this row was written by a *previous* streamer generation' — and a separate column keeps the two concerns from fighting each other. It also leaves `is_online = true` intact across restarts, which is what the **online warm-up** reads to know which providers to prioritise on cold boot."
>
> **Engineer:** "If the **GroupSpec** asks for region=us-west, do I match the **self-attribute** or the **signed-attribute**?"
>
> **Domain expert:** "`requirements.attributes` matches **self-attributes** only. `requirements.signedBy` is independent — it asserts the provider has *some* signature from those auditors, not that the matched attribute itself is signed. Different fields, different semantics, two columns."

## Flagged ambiguities

- **"snapshot"** was used for both the legacy historical row and the bid-screening current state. Resolved: legacy = **provider snapshot**, bid-screening = **provider inventory**.
- **"online"** in `provider.isOnline` (legacy) means "passed the last 15-min HTTP probe". In `provider_inventory.is_online` it means "streamer has an open `streamStatus` channel and has received at least one message since reconnect". These will diverge intentionally.
- **"attribute"** without qualifier is ambiguous. Always say **self-attribute** or **signed-attribute** — they are independent on-chain facts and the **prefilter** treats them differently.
- **"available CPU"** vs **"max node free CPU"** — `total_available_cpu` is the cluster sum, used to filter on the GroupSpec total; `max_node_free_cpu` is the largest single-node free slice, used to filter on the largest replica. The first does not imply the second.
- **"storage"** is overloaded. **Ephemeral storage** is per-node and disappears with the workload. **Persistent storage** is cluster-wide and survives. **RAM storage** is allocated against node memory. The three are tracked separately and flow through different rollup columns.
