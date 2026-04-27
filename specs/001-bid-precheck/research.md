# Research: Bid Screening

**Feature**: Bid Screening
**Date**: 2026-04-27

## R1: Existing Provider Data Access Patterns

**Decision**: Use Sequelize (existing provider models) for data access,
not Drizzle ORM.

**Rationale**: All existing provider-related code (Provider,
ProviderSnapshot, ProviderSnapshotNode, ProviderSnapshotNodeGPU,
ProviderSnapshotStorage, ProviderAttribute, ProviderAttributeSignature)
uses Sequelize models. The constitution says "Sequelize is legacy and
MUST NOT be extended to new features" — however, this feature only
reads existing Sequelize models, it does not create new ones. Adding
Drizzle equivalents of 7+ existing Sequelize models would be a
separate migration effort outside this feature's scope.

**Alternatives considered**:
- Drizzle ORM: Would require creating new Drizzle schema definitions
  for all provider tables. Cleaner long-term but out of scope.
- Raw SQL: Used by GpuRepository for complex queries. Viable for the
  snapshot-with-nodes query if Sequelize eager loading proves too slow.

## R2: GroupSpec Input Type

**Decision**: Accept `GroupSpec` from `@akashnetwork/chain-sdk`
(deployment/v1beta4) as the API input. The frontend already has this
type available from SDL parsing.

**Rationale**: GroupSpec is the canonical protobuf type representing
a deployment group's resource requirements and placement constraints.
It contains:
- `name`: group identifier
- `requirements.attributes`: provider attribute filters (key-value)
- `requirements.signedBy`: auditor constraints (allOf/anyOf)
- `resources[]`: array of ResourceUnit (resource + count + price)

Each ResourceUnit.resource contains CPU, memory, GPU, storage[],
endpoints with their respective quantities and attributes.

**Alternatives considered**:
- Custom input DTO: Would decouple from protobuf but creates a
  translation layer and risks divergence from on-chain semantics.
- SDL string: Would require SDL parsing in the API. Parsing is
  already done by the frontend.

## R3: Bin-Packing Algorithm Implementation Strategy

**Decision**: Implement the Go reference Adjust() algorithm as a
TypeScript service class (`ClusterInventoryMatcherService`) with
pure functions. The algorithm operates on in-memory data structures
copied from DB results.

**Rationale**: The Go implementation is well-specified with clear
semantics (transactional deep-copy, greedy placement, node restart
after group completion). A faithful TypeScript port ensures 100%
match with the Go reference (SC-002, SC-003 in spec).

Key implementation notes:
- `ResourcePair` class with `SubNLZ()` and `SubMilliNLZ()` methods
- Deep copy via structured clone or manual copy
- Storage classification (ram → memory, ephemeral → node storage,
  persistent → cluster pool)
- GPU matching with vendor/model/ram/interface and wildcard support
- Replica consistency check across all resource dimensions
- Node restart (outer loop reset) after completing a resource group

**Alternatives considered**:
- Database-level filtering (SQL): Could pre-filter providers with
  aggregate checks (total CPU >= required), but cannot implement
  the node-level bin-packing in SQL. Use as a fast pre-filter only.
- Worker threads: For 1,000 providers the algorithm should complete
  in <5s on the main thread. Only add worker threads if profiling
  shows event loop blocking.

## R4: Storage Class Mapping

**Decision**: No mapping needed. The database stores storage classes
as `beta1`, `beta2`, `beta3` directly, matching SDL class names.

**Rationale**: Confirmed by inspecting the indexer code:
- `apps/indexer/src/providers/statusEndpointHandlers/grpc.ts` stores
  `storage.info.class` directly from the provider gRPC response
- Node capabilities map: beta1 → `capabilitiesStorageHDD`,
  beta2 → `capabilitiesStorageSSD`, beta3 → `capabilitiesStorageNVME`

**Alternatives considered**: None — the mapping is already aligned.

## R5: Audited Provider Definition

**Decision**: A provider is "audited" if it has a
`ProviderAttributeSignature` from any auditor in the
`MANAGED_WALLET_LEASE_ALLOWED_AUDITORS` config list. Currently this
contains only the Akash auditor
(`akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63`).

**Rationale**: This pattern is already used in:
- `BidService.filterBidsByAuditedProviders()` — filters bids by
  audited providers using the same config
- `TrialValidationService.validateLeaseProvidersAuditors()` — validates
  provider auditor status during lease creation

Reusing this config ensures consistency across the codebase.

**Alternatives considered**:
- Hardcoded auditor address: Fragile; config-based is already in use.
- Any signature = audited: Too permissive; untrusted auditors exist.

## R6: Performance Strategy

**Decision**: Three-stage pipeline with early exit:
1. Attribute/auditor pre-filter (DB query) → candidate provider
   addresses
2. Aggregate resource pre-filter (DB query) → providers with
   sufficient total resources (sum of available across nodes)
3. Full bin-packing simulation (in-memory) → final result

**Rationale**: Stage 1 uses the existing attribute matching query
pattern. Stage 2 is a cheap SQL check that eliminates obviously
under-resourced providers before the O(N*G*R*S) bin-packing runs.
Stage 3 runs only on survivors.

For 1,000 providers:
- Stage 1: ~50ms (indexed attribute query)
- Stage 2: ~100ms (aggregate sum query)
- Stage 3: ~1-3s worst case (bin-packing on ~100-500 survivors)
- Total: well within 5s target

**Alternatives considered**:
- Skip stage 2: Viable for 100 providers, risky for 10,000.
- Caching inventory data: Premature optimization; add if profiling
  shows DB round-trips dominate.

## R7: API Authentication

**Decision**: Use `SECURITY_NONE` — the endpoint is public. Provider
data is public blockchain information, and the screening is a read-only
advisory query.

**Rationale**: The GPU list endpoint (`/v1/gpu`) uses `SECURITY_NONE`
and follows the same pattern — public provider capability data. Rate
limiting can be added at the infrastructure level if abuse occurs.

**Alternatives considered**:
- `SECURITY_BEARER_OR_API_KEY`: Would require auth for what is
  essentially a public data query. Creates friction for anonymous
  deployment flow exploration.

## R8: Event Loop Protection — Worker Thread Pool (Future)

**Decision**: Not implementing now. Documented as the recommended
optimization path if bin-packing CPU time becomes a bottleneck.

**Rationale**: At current scale (100-1,000 providers), bin-packing
runs in 10-50ms after pre-filtering — negligible for the event loop.
The three-stage pipeline (R6) ensures only a fraction of providers
reach the CPU-intensive stage. However, if provider counts reach
5,000-10,000+ or concurrent request volume exceeds 50, the
synchronous bin-packing loop could cause latency spikes for other
HTTP requests sharing the event loop.

**Recommended approach when needed**: Use piscina
(https://piscinajs.dev/) as a worker thread pool with
SharedArrayBuffer for zero-copy data sharing:

1. Stages 1-2 (attribute filter + aggregate check) remain on the
   main thread — they are async DB queries and don't block.
2. Serialize surviving providers' inventory into a SharedArrayBuffer
   using a flat binary format: fixed-size records for nodes
   (cpu_alloc/cpu_used/mem_alloc/mem_used/ephemeral_alloc/
   ephemeral_used/gpu_alloc/gpu_used as BigInt64Array), GPU info as
   fixed-length structs, cluster storage pools similarly.
3. Dispatch bin-packing to a piscina worker via
   `piscina.run(binPackTask, { transferList: [...] })`.
4. Worker reads SharedArrayBuffer, runs the matching algorithm,
   returns an array of matching provider owner addresses.
5. Main thread enriches with metadata (region, uptime, audited) and
   responds.

**Benefits**:
- Event loop stays completely free during bin-packing
- Multiple concurrent screening requests get their own workers
- SharedArrayBuffer avoids serialization/deserialization overhead
- Scales with available CPU cores

**Trigger criteria** (when to implement):
- Profiling shows bin-packing CPU time >200ms per request
- P95 latency exceeds 5s at target provider counts
- Concurrent screening requests cause measurable latency spikes on
  other API endpoints

**Alternatives considered**:
- `setImmediate()` chunking: Yields to event loop every N providers.
  Simpler but still runs on main thread and adds ~1ms per yield.
  Suitable as a quick fix but not a scaling solution.
- Cluster mode (multiple Node.js processes): Heavier-weight, already
  available at the infrastructure level, doesn't help a single
  request's latency.
