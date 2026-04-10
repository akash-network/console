# Bid Precheck Stage 1 — Database Pre-filtering API

**Issue:** CON-187 (part of CON-186)
**Date:** 2026-04-09

## Context

When a user submits a deployment on Akash, every online provider receives the order and decides whether to bid. With growing provider count (currently ~72 online, potentially 1000+), calling each provider's bid-screening endpoint is not scalable.

Stage 1 pre-filters providers using our indexer database to narrow the candidate set before Stage 2 calls the provider's `/v1/bid-screening` gRPC/REST endpoint (akash-network/provider#386) for real inventory checks and pricing.

## Endpoint

```
POST /v1/bid-screening
```

No authentication required (`SECURITY_NONE`) — read-only public data, same as `GET /v1/providers`.

## Request Schema

Mirrors the provider proto `GroupSpec` → `ResourceUnit` → `Resources` structure so the frontend can reuse the same shape for both Stage 1 and Stage 2.

```typescript
BidPrecheckRequest {
  resources: ResourceUnit[]     // GroupSpec.resources (repeated ResourceUnit)
  requirements: {               // GroupSpec.requirements (PlacementRequirements)
    attributes: { key: string, value: string }[]
    signedBy: { allOf: string[], anyOf: string[] }
  }
  limit?: number                // default 50, max 200
}

ResourceUnit {
  cpu: number                   // millicpu (1000 = 1 vCPU)
  memory: number                // bytes
  gpu: number                   // count per replica (0 for no GPU)
  gpuAttributes?: {             // required when gpu > 0
    vendor: string              // e.g. "nvidia"
    model?: string              // e.g. "rtx4090", "a100"
    interface?: string          // e.g. "PCIe"
    memorySize?: string         // e.g. "24Gi"
  }
  ephemeralStorage: number      // bytes
  persistentStorage?: number    // bytes, omit if none
  persistentStorageClass?: "beta1" | "beta2" | "beta3"  // hdd, ssd, nvme
  count: number                 // replica count — multiplies ALL resources
}
```

**Resource aggregation:** For each resource unit, total = per-replica value * count. Across all resource units, totals are summed for the provider-level capacity check. Per-node GPU checks use the per-replica `gpu` value (not the total).

## Response Schema

```typescript
BidPrecheckResponse {
  providers: ProviderMatch[]
  total: number                 // count before LIMIT (enables "showing 50 of 127")
  queryTimeMs: number           // for observability
  constraints?: Constraint[]    // only populated when total === 0
}

ProviderMatch {
  owner: string                 // provider address
  hostUri: string               // provider endpoint URL
  leaseCount: number
  availableCpu: number          // millicpu
  availableMemory: number       // bytes
  availableGpu: number
  availableEphemeralStorage: number   // bytes
  availablePersistentStorage: number  // bytes
}

Constraint {
  name: string                  // e.g. "GPU model (nvidia/h100)"
  count: number                 // providers passing this filter alone
  actionableFeedback: string    // user-facing suggestion
}
```

## Query Logic

### Main query

Single SQL query against the chain indexer database (Sequelize raw query via `@inject(CHAIN_DB)`).

**Base filters (always applied):**
- `provider.deletedHeight IS NULL` — active providers only
- `provider.isOnline = true` — currently reachable
- JOIN `providerSnapshot` via `lastSuccessfulSnapshotId`
- `availableCPU >= totalCpu`
- `availableMemory >= totalMemory`
- `availableEphemeralStorage >= totalEphemeralStorage`

**Conditional filters:**
- **GPU (totalGpu > 0):** `availableGPU >= totalGpu` + JOIN `providerSnapshotNode` and `providerSnapshotNodeGPU` for vendor/model/interface/memorySize matching + per-node available GPU check (`gpuAllocatable - gpuAllocated >= perReplicaGpu`)
- **Persistent storage:** `availablePersistentStorage >= totalPersistentStorage` + JOIN `providerSnapshotStorage` for class matching and per-class capacity check
- **Attributes:** JOIN `providerAttribute` + HAVING clause with COUNT FILTER for each key=value pair
- **Auditor signatures (anyOf):** JOIN `providerAttributeSignature` + `auditor IN (:anyOfAuditors)`
- **Auditor signatures (allOf):** HAVING clause ensuring every auditor is present

**Ordering:** `leaseCount DESC, availableCPU DESC` — prioritizes battle-tested providers with the most capacity.

**Pagination:** `LIMIT :limit` (default 50, max 200).

### Count query

Runs the same WHERE/JOIN/HAVING logic but `SELECT COUNT(DISTINCT p.owner)` to get the true total before LIMIT.

### Constraint diagnosis (only when total === 0)

Runs independent single-constraint queries to identify which filter is the blocker. Each query checks one constraint against the online provider baseline. Reports count and percentage for each, with actionable feedback for blockers (0 providers) and narrow filters (<5 providers).

## Architecture

### File structure (new files in `apps/api/src/provider/`)

```
http-schemas/bid-precheck.schema.ts           # Zod request/response schemas
routes/bid-precheck/bid-precheck.router.ts    # POST route definition
controllers/bid-precheck/bid-precheck.controller.ts
services/bid-precheck/bid-precheck.service.ts
services/bid-precheck/bid-precheck.service.spec.ts  # unit tests
```

### Dependency flow

```
bid-precheck.router.ts
  → container.resolve(BidPrecheckController)
    → BidPrecheckService(@inject(CHAIN_DB) chainDb: Sequelize)
      → buildStage1Query(spec) → SQL string + replacements
      → chainDb.query(sql, replacements)
      → if total === 0: diagnoseConstraints(spec)
```

### Integration with existing code

- Router registered in `apps/api/src/provider/routes/index.ts` alongside existing provider routes
- Uses same `createRoute` + `OpenApiHonoHandler` pattern
- Injects `CHAIN_DB` (Sequelize) directly — no new DB connection needed
- `@singleton()` service, same as other provider services

## Mapping to Provider Bid Screening (PR 386)

| Provider CheckBidEligibility step | Stage 1 DB equivalent | Stage 2 (future) |
|---|---|---|
| `gspec.MatchAttributes(providerAttrs)` | `providerAttribute` JOIN + HAVING | - |
| `bidAttrs.SubsetOf(gspec.Requirements.Attributes)` | - | Provider call |
| `gspec.MatchResourcesRequirements(attr)` — auditor sigs | `providerAttributeSignature` JOIN | - |
| `maxGroupVolumes` check | - | Provider call |
| `gspec.Requirements.SignedBy` | `providerAttributeSignature` HAVING | - |
| `gspec.ValidateBasic()` | Zod schema validation | - |
| `DryRunReserve` (real inventory) | `providerSnapshot.available*` approximation | Provider call |
| `CalculatePrice` | - | Provider call (returns `DecCoin`) |
| Hostname availability | - | Provider call |

Stage 1 is a superset filter — it may include providers that would fail Stage 2, but should never exclude providers that would pass.

## Test Strategy

Unit tests for `BidPrecheckService` — mock `CHAIN_DB` Sequelize instance, verify SQL generation and parameter binding.

### Test cases (~25 tests)

**Resource aggregation:**
1. Single resource unit — CPU, memory, storage passed correctly
2. Multi-replica — resources multiplied by count
3. Multiple resource units — totals summed across units
4. GPU per-node check uses per-replica count, not total

**Filter generation:**
5. CPU-only (no GPU, no persistent storage) — minimal JOINs
6. GPU with vendor only (no model) — vendor filter, no model filter
7. GPU with vendor + model — both filters applied
8. GPU with all attributes (vendor, model, interface, memorySize)
9. Persistent storage with class — class filter + capacity check
10. Persistent storage without class — capacity only, no class filter
11. Attributes — single attribute HAVING clause
12. Multiple attributes — multiple HAVING conditions ANDed
13. SignedBy anyOf — auditor IN clause
14. SignedBy allOf — HAVING with per-auditor COUNT
15. Combined: GPU + persistent storage + attributes + signedBy

**Limit handling:**
16. Default limit (50) when not specified
17. Custom limit respected
18. Limit clamped to max 200

**Constraint diagnosis:**
19. Runs only when main query returns 0 results
20. Does not run when results > 0
21. Each constraint checked independently against baseline
22. Actionable feedback populated for blockers

**Edge cases:**
23. Empty attributes array — no attribute JOIN
24. Empty signedBy (allOf=[], anyOf=[]) — no signature JOIN
25. Zero GPU — no GPU JOINs
26. All zeros except CPU/memory/storage — minimal query

**Input validation (Zod schema):**
27. Missing required fields rejected
28. gpu > 0 without gpuAttributes — rejected
29. Invalid persistentStorageClass — rejected
30. Empty resources array — rejected
