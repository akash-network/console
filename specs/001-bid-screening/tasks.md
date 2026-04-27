# Tasks: Bid Screening

**Input**: Design documents from `specs/001-bid-screening/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Tests are included as they are required by the project constitution (Principle III: Test-Covered Changes, api patch target 80%).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Module root**: `apps/api/src/bid-screening/`
- **Tests**: Colocated as `*.spec.ts` next to source files
- Paths shown below use `@src/` alias for `apps/api/src/`

---

## Phase 1: Setup

**Purpose**: Create module directory structure and shared type definitions

- [ ] T001 Create bid-screening module directory structure under `apps/api/src/bid-screening/` with subdirectories: controllers/bid-screening/, services/bid-screening/, services/cluster-inventory-matcher/, repositories/bid-screening/, http-schemas/, routes/, lib/, types/, providers/
- [ ] T002 [P] Define inventory types in `apps/api/src/bid-screening/types/inventory.types.ts`: ClusterInventory, NodeInventory, GpuInventory, GpuInfo, ClusterStoragePool, RequestedResourceUnit, RequestedResources, RequestedStorage, MatchResult, BidScreeningResult
- [ ] T003 [P] Define Zod request/response schemas in `apps/api/src/bid-screening/http-schemas/bid-screening.schema.ts`: BidScreeningRequestSchema (matching GroupSpec structure with ResourceValue as string-encoded integers), BidScreeningResponseSchema (providers array with owner, hostUri, region, uptime7d, isAudited), BidScreeningErrorSchema

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core library utilities and data access layer that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Implement ResourcePair class in `apps/api/src/bid-screening/lib/resource-pair.ts` with: constructor(allocatable, allocated), available() returning clamped bigint, subNLZ(val) atomic check-and-subtract, subMilliNLZ(val) milli-unit variant for CPU. Handle -1 sentinel as unlimited allocatable.
- [ ] T005 [P] Implement ResourcePair tests in `apps/api/src/bid-screening/lib/resource-pair.spec.ts`: test available() clamping, subNLZ success/failure, subMilliNLZ milli-unit math, -1 sentinel handling, zero-available edge case
- [ ] T006 Implement storage attribute parser in `apps/api/src/bid-screening/lib/storage-attribute-parser.ts`: parseStorageAttributes(attributes) extracting persistent (bool) and class (string) from attribute key-value pairs. Validate persistent+class combinations per Go spec Section 3.
- [ ] T007 [P] Implement storage attribute parser tests in `apps/api/src/bid-screening/lib/storage-attribute-parser.spec.ts`: test ephemeral, ram-backed, persistent classification; invalid persistent+ram combination; missing class on persistent
- [ ] T008 Implement BidScreeningRepository in `apps/api/src/bid-screening/repositories/bid-screening/bid-screening.repository.ts` as @singleton() using Sequelize: method to load online providers with their lastSuccessfulSnapshot, snapshot nodes (with GPUs and CPUs), and snapshot storage. Accept optional owner address filter array for scoping. Include provider metadata (owner, hostUri, ipRegion, uptime7d).
- [ ] T009 Implement BidScreeningRepository tests in `apps/api/src/bid-screening/repositories/bid-screening/bid-screening.repository.spec.ts`: test loading providers with snapshots, filtering by addresses, excluding offline providers, handling missing snapshots
- [ ] T010 Implement snapshot-to-inventory mapper function in `apps/api/src/bid-screening/lib/inventory-mapper.ts`: convert Sequelize Provider+Snapshot+Node+GPU+Storage models into ClusterInventory in-memory types. Map node capability booleans (capabilitiesStorageHDD/SSD/NVME) to storage class strings (beta1/beta2/beta3).
- [ ] T011 [P] Implement inventory mapper tests in `apps/api/src/bid-screening/lib/inventory-mapper.spec.ts`: test conversion of node resources, GPU info mapping, storage class capability mapping, empty node handling
- [ ] T012 Implement GroupSpec-to-RequestedResourceUnit mapper in `apps/api/src/bid-screening/lib/groupspec-mapper.ts`: parse ResourceValue.val (string-encoded Uint8Array) to bigint, extract CPU/memory/GPU/storage from GroupSpec resources array, produce RequestedResourceUnit[]
- [ ] T013 [P] Implement GroupSpec mapper tests in `apps/api/src/bid-screening/lib/groupspec-mapper.spec.ts`: test ResourceValue parsing, CPU milli-unit extraction, storage attribute extraction, GPU attribute extraction, empty resources handling

**Checkpoint**: Foundation ready — all library utilities tested, repository can load provider data, mappers convert between external and internal types

---

## Phase 3: User Story 1 - Basic Resource Filtering (Priority: P1)

**Goal**: Screen providers by CPU, memory, and ephemeral storage capacity using greedy bin-packing across nodes

**Independent Test**: POST /v1/bid-screening with a single resource unit requesting 1 vCPU + 2 GiB memory + 1 GiB ephemeral → returns only providers with sufficient node capacity

### Implementation for User Story 1

- [ ] T014 [US1] Implement tryAdjust in ClusterInventoryMatcherService at `apps/api/src/bid-screening/services/cluster-inventory-matcher/cluster-inventory-matcher.service.ts`: single replica placement on a node — deep copy node, subtract CPU (subMilliNLZ), memory (subNLZ), ephemeral storage (subNLZ). Return (sparams, node_ok, cluster_ok) tuple. GPU and persistent storage handling are stubs returning true (added in US2/US3).
- [ ] T015 [US1] Implement Adjust (single-group) in ClusterInventoryMatcherService: iterate nodes, call tryAdjust for each replica, decrement count on success, handle node exhaustion (try next node). Operate on deep-copied inventory. For now handle single resource unit only (multi-group added in US5).
- [ ] T016 [US1] Implement ClusterInventoryMatcherService tests in `apps/api/src/bid-screening/services/cluster-inventory-matcher/cluster-inventory-matcher.service.spec.ts`: single node sufficient, single node insufficient CPU, single node insufficient memory, multi-node spread for replicas, zero-node provider, all replicas placed on one node
- [ ] T017 [US1] Implement BidScreeningService in `apps/api/src/bid-screening/services/bid-screening/bid-screening.service.ts` as @singleton(): inject BidScreeningRepository and ClusterInventoryMatcherService. Method screen(groupSpec): load online providers → map to inventory → run matcher per provider → collect passing providers with metadata (owner, hostUri, region, uptime7d, isAudited=false placeholder). No attribute filtering yet (added in US4).
- [ ] T018 [US1] Implement BidScreeningService tests in `apps/api/src/bid-screening/services/bid-screening/bid-screening.service.spec.ts`: test orchestration flow with mocked repository and matcher, test empty provider list, test all providers failing, test mixed pass/fail
- [ ] T019 [US1] Implement BidScreeningController in `apps/api/src/bid-screening/controllers/bid-screening/bid-screening.controller.ts` as @singleton(): inject BidScreeningService, method screenProviders(groupSpec) calls service and returns response
- [ ] T020 [US1] Create route definition and router in `apps/api/src/bid-screening/routes/bid-screening.router.ts`: POST /v1/bid-screening using createRoute + OpenApiHonoHandler with Zod schemas from T003, SECURITY_NONE, cache max-age 30 stale-while-revalidate 60. Handler resolves BidScreeningController from container.
- [ ] T021 [US1] Register tsyringe providers in `apps/api/src/bid-screening/providers/bid-screening.providers.ts` and register bid-screening router in the main API router at `apps/api/src/routers/`
- [ ] T022 [US1] Implement BidScreeningController tests in `apps/api/src/bid-screening/controllers/bid-screening/bid-screening.controller.spec.ts`: test request validation, successful response shape, empty results

**Checkpoint**: US1 complete — POST /v1/bid-screening accepts a GroupSpec and returns providers with sufficient CPU, memory, and ephemeral storage

---

## Phase 4: User Story 2 - GPU-Aware Filtering (Priority: P2)

**Goal**: Extend matching to filter by GPU vendor, model (with wildcard), optional RAM size, and interface type

**Independent Test**: POST /v1/bid-screening requesting 1 NVIDIA A100 GPU with 80Gi VRAM → returns only providers with matching GPUs

### Implementation for User Story 2

- [ ] T023 [P] [US2] Implement GPU attribute parser in `apps/api/src/bid-screening/lib/gpu-attribute-parser.ts`: parseGPUAttributes(attributes) parsing slash-delimited key format (vendor/nvidia/model/a100/ram/80Gi/interface/pcie), ExistsOrWildcard for model lookup, FilterGPUInterface to normalize sxm* variants
- [ ] T024 [P] [US2] Implement GPU attribute parser tests in `apps/api/src/bid-screening/lib/gpu-attribute-parser.spec.ts`: test vendor/model parsing, wildcard model, ram/interface optional fields, sxm normalization (sxm2→sxm, SXM4→sxm), invalid format errors, multiple vendors
- [ ] T025 [US2] Add tryAdjustGPU to ClusterInventoryMatcherService: match requested GPU against node's GpuInfo list by vendor, model (with wildcard), optional RAM, optional interface. Decrement GPU count via subNLZ. Mutate requested GPU attributes to reflect matched config (for replica consistency). Set scheduler params.
- [ ] T026 [US2] Add GPU matching tests to `apps/api/src/bid-screening/services/cluster-inventory-matcher/cluster-inventory-matcher.service.spec.ts`: exact model match, wildcard model, RAM filter, interface filter with sxm normalization, 2 GPUs on single node, no matching GPU, zero GPU request passes

**Checkpoint**: US2 complete — GPU-aware screening works with vendor/model/RAM/interface matching and wildcards

---

## Phase 5: User Story 3 - Persistent Storage Class Filtering (Priority: P3)

**Goal**: Handle persistent storage (deducted from cluster pool), RAM-backed storage (deducted from node memory), and storage class capability checks

**Independent Test**: POST /v1/bid-screening requesting 50 GiB persistent beta2 volume → returns only providers with beta2 capability and sufficient pool capacity

### Implementation for User Story 3

- [ ] T027 [US3] Add storage classification to tryAdjust in ClusterInventoryMatcherService: use parseStorageAttributes to classify each storage volume. RAM-backed → subNLZ from node memory. Ephemeral → subNLZ from node ephemeral storage. Persistent → check node storage class capability (IsStorageClassSupported) then subNLZ from cluster storage pool.
- [ ] T028 [US3] Add storage matching tests to `apps/api/src/bid-screening/services/cluster-inventory-matcher/cluster-inventory-matcher.service.spec.ts`: ephemeral deduction, RAM-backed deduction from memory (stacks with memory resource), persistent deduction from cluster pool, node without storage class capability, exhausted cluster pool (cluster failure), invalid persistent+ram validation error

**Checkpoint**: US3 complete — all three storage categories handled correctly with class-aware matching

---

## Phase 6: User Story 4 - Provider Attribute & Auditor Filtering (Priority: P4)

**Goal**: Pre-filter providers by placement attributes (with glob support) and auditor signatures (signedBy allOf/anyOf) before bin-packing

**Independent Test**: POST /v1/bid-screening with requirements.attributes=[{key:"tier",value:"community"}] and signedBy.allOf=[auditorAddress] → only attributed+audited providers considered

### Implementation for User Story 4

- [ ] T029 [US4] Add attribute/auditor pre-filtering to BidScreeningService: extract requirements.attributes and requirements.signedBy from GroupSpec. Call existing ProviderRepository.getProvidersHostUriByAttributes (or equivalent) with glob-enabled attribute matching and allOf/anyOf auditor constraints. Pass resulting owner addresses to BidScreeningRepository to scope snapshot loading. Return empty immediately if zero candidates.
- [ ] T030 [US4] Add isAudited enrichment to BidScreeningService: for each passing provider, check if any ProviderAttributeSignature auditor is in the MANAGED_WALLET_LEASE_ALLOWED_AUDITORS config list (reuse existing BillingConfigService pattern). Replace the placeholder false from US1.
- [ ] T031 [US4] Add attribute/auditor filtering tests to `apps/api/src/bid-screening/services/bid-screening/bid-screening.service.spec.ts`: test attribute pre-filter narrows candidates, test signedBy allOf requiring all auditors, test signedBy anyOf requiring any, test combined attributes+signedBy, test empty requirements skips filtering, test zero candidates returns immediately, test isAudited true/false enrichment

**Checkpoint**: US4 complete — full attribute and auditor pre-filtering pipeline with isAudited response enrichment

---

## Phase 7: User Story 5 - Multi-Group Replica Consistency (Priority: P5)

**Goal**: Handle multiple resource units with different requirements and replica counts, enforce replica consistency invariant, implement full Adjust() semantics with node restart after group completion

**Independent Test**: POST /v1/bid-screening with 2 resource units (4 CPU-only replicas + 2 GPU replicas) → correctly evaluates multi-node bin-packing

### Implementation for User Story 5

- [ ] T032 [US5] Extend Adjust in ClusterInventoryMatcherService to handle multiple resource groups: reverse iteration over resource groups, inner while loop per replica, node restart (reset to index 0) after completing all replicas of a group, remove completed group from list
- [ ] T033 [US5] Add replica consistency invariant check to ClusterInventoryMatcherService: after first replica records adjusted attributes and scheduler params, subsequent replicas must produce identical values. Return ErrGroupResourceMismatch on divergence.
- [ ] T034 [US5] Add multi-group and consistency tests to `apps/api/src/bid-screening/services/cluster-inventory-matcher/cluster-inventory-matcher.service.spec.ts`: 2 groups spread across nodes, 4 replicas across 2 GPU nodes, group completion triggers node restart, replica consistency failure (different GPU model), mixed CPU+GPU groups, all groups placed successfully, insufficient capacity for one group fails entire provider

**Checkpoint**: US5 complete — full Adjust() semantics matching Go reference implementation

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Observability, validation edge cases, and performance optimization

- [ ] T035 [P] Add structured logging to BidScreeningService and ClusterInventoryMatcherService in their respective files: use LoggerService with events BID_SCREENING_START, BID_SCREENING_ATTRIBUTE_FILTER, BID_SCREENING_MATCH_PROVIDER, BID_SCREENING_COMPLETE. Include provider count, candidate count, matched count, and duration.
- [ ] T036 [P] Add input validation for edge cases (FR-007) in `apps/api/src/bid-screening/services/bid-screening/bid-screening.service.ts`: validate GroupSpec has at least one resource unit, validate persistent storage has valid class, validate GPU attributes are well-formed. Throw http-errors BadRequest with descriptive messages.
- [ ] T037 Add aggregate resource pre-filter to BidScreeningRepository: before full snapshot loading, run a lightweight SQL query to exclude providers whose total available CPU/memory/storage (sum across nodes) is obviously insufficient. This is the Stage 2 optimization from research.md R6.
- [ ] T038 Add aggregate pre-filter test to `apps/api/src/bid-screening/repositories/bid-screening/bid-screening.repository.spec.ts`: test providers with insufficient aggregate resources are excluded before snapshot loading
- [ ] T039 [P] Add scale benchmark test in `apps/api/test/functional/bid-screening-benchmark.spec.ts`: seed a synthetic dataset of 10,000 providers (varying node counts 1-50, mixed GPU/storage capabilities), run POST /v1/bid-screening with a representative GroupSpec, assert response completes within 5 seconds. Use Vitest with extended timeout.
- [ ] T040 [P] Add concurrent load test in `apps/api/test/functional/bid-screening-concurrency.spec.ts`: fire 50 parallel POST /v1/bid-screening requests with a representative GroupSpec against a seeded provider dataset (~1,000 providers), assert all 50 responses return 200 within 5 seconds and produce consistent results. No request may be starved.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (Phase 3): First — establishes the API endpoint and core matching
  - US2 (Phase 4): Depends on US1 (extends tryAdjust)
  - US3 (Phase 5): Depends on US1 (extends tryAdjust)
  - US4 (Phase 6): Depends on US1 (extends BidScreeningService)
  - US5 (Phase 7): Depends on US1, US2, US3 (extends Adjust with all resource types)
  - Note: US2, US3, and US4 are independent of each other and could be parallelized
- **Polish (Phase 8)**: Depends on all user stories being complete

### Within Each User Story

- Implementation before tests (tests reference the implementation)
- Core algorithm before orchestration service
- Service before controller
- All within-story tasks before checkpoint

### Parallel Opportunities

- T002, T003 can run in parallel (types and schemas are independent)
- T005, T007, T009, T011, T013 (test files) can run in parallel with each other
- T023, T024 (GPU parser + tests) can run in parallel with other US2 work
- T035, T036 (logging + validation) can run in parallel
- US2, US3, US4 can run in parallel after US1 is complete (different concerns)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Basic Resource Filtering)
4. **STOP and VALIDATE**: Test endpoint with basic CPU/memory/storage GroupSpec
5. Deploy/demo if ready — this alone is valuable

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Basic screening works (MVP!)
3. Add US2 → GPU-aware screening
4. Add US3 → Storage-class-aware screening
5. Add US4 → Attribute/auditor filtering (full pipeline)
6. Add US5 → Multi-group consistency (production-grade)
7. Polish → Logging, validation, performance

### Parallel Team Strategy

With multiple developers after US1 is complete:
- Developer A: User Story 2 (GPU)
- Developer B: User Story 3 (Storage)
- Developer C: User Story 4 (Attributes)
- All converge for US5 (requires all prior resource types)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable via the API endpoint
- Constitution Principle III: All code changes include tests (api patch target 80%)
- Constitution Principle VI: LoggerService for all logging (T035)
- Constitution Principle VII: OpenAPI-first with createRoute + Zod schemas (T003, T020)
- Commit after each task or logical group
