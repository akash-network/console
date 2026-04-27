# Implementation Plan: Bid Screening

**Branch**: `001-bid-screening` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-bid-screening/spec.md`

## Summary

Build a database-backed provider screening service that accepts a
GroupSpec (from @akashnetwork/chain-sdk) and returns a filtered list
of providers capable of fulfilling the deployment. The service
implements a greedy bin-packing algorithm matching the Go reference
implementation's Adjust() semantics, runs attribute/auditor
pre-filtering, and returns provider metadata (owner, region, uptime,
host URI, audited status). Target: <5s for 1,000 providers.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js >= 24.14.1
**Primary Dependencies**: Hono + @hono/zod-openapi, tsyringe, Sequelize (legacy provider models), @akashnetwork/chain-sdk (GroupSpec type)
**Storage**: PostgreSQL (existing provider/snapshot tables via Sequelize)
**Testing**: Vitest (unit + functional), setup() pattern, colocated *.spec.ts
**Target Platform**: Linux server (apps/api)
**Project Type**: REST API endpoint (web-service)
**Performance Goals**: <5s hard ceiling for up to 10,000 providers; sub-second for ~1,000; 50 concurrent requests within 5s each
**Constraints**: Read-only DB access, no schema changes, must match Go reference implementation semantics
**Scale/Scope**: ~100 providers today, ~1,000 near-term, <10,000 upper bound; 1-50 nodes per provider; 1-10 resource groups per GroupSpec

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Strict Type Safety | PASS | All new code strict TS; GroupSpec types from chain-sdk; Zod schemas for API contract |
| II. SOLID & Acyclic Deps | PASS | Separate controller/service/repository layers; bin-packing algorithm is a standalone pure-function service; no cyclic deps |
| III. Test Coverage | PASS | Unit tests for bin-packing algorithm, functional tests for API endpoint; api patch target 80% |
| IV. Transaction Safety | PASS | Read-only queries; no DB transactions; no external service calls during processing |
| V. Concurrency & Performance | PASS | Bin-packing is CPU-bound but bounded by provider/node counts; will chunk if needed; no shared mutable state |
| VI. Structured Observability | PASS | LoggerService for all logging; structured events for screening operations |
| VII. OpenAPI-First | PASS | createRoute + OpenApiHonoHandler + Zod schemas for request/response |

All gates pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-bid-screening/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.md           # API endpoint contract
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/api/src/
└── bid-screening/
    ├── controllers/
    │   └── bid-screening/
    │       ├── bid-screening.controller.ts
    │       └── bid-screening.controller.spec.ts
    ├── services/
    │   ├── bid-screening/
    │   │   ├── bid-screening.service.ts
    │   │   └── bid-screening.service.spec.ts
    │   └── cluster-inventory-matcher/
    │       ├── cluster-inventory-matcher.service.ts
    │       └── cluster-inventory-matcher.service.spec.ts
    ├── repositories/
    │   └── bid-screening/
    │       ├── bid-screening.repository.ts
    │       └── bid-screening.repository.spec.ts
    ├── http-schemas/
    │   └── bid-screening.schema.ts
    ├── routes/
    │   └── bid-screening.router.ts
    ├── lib/
    │   ├── resource-pair.ts
    │   ├── resource-pair.spec.ts
    │   ├── gpu-attribute-parser.ts
    │   ├── gpu-attribute-parser.spec.ts
    │   ├── storage-attribute-parser.ts
    │   └── storage-attribute-parser.spec.ts
    ├── types/
    │   └── inventory.types.ts
    └── providers/
        └── bid-screening.providers.ts
```

**Structure Decision**: New `bid-screening/` module under `apps/api/src/`
following the established module pattern (controllers, services,
repositories, http-schemas, routes). The bin-packing algorithm lives
in `ClusterInventoryMatcherService` — a standalone, stateless service
with no DB dependency (receives inventory data, returns match result).
Attribute parsing utilities (`ResourcePair`, GPU/storage parsers) are
in `lib/` as pure functions with their own unit tests.

### Key Architectural Decisions

1. **Separate `ClusterInventoryMatcherService` from `BidScreeningService`**:
   The matcher is a pure algorithmic service that takes inventory data
   and resource requirements, returning a boolean. The screening service
   orchestrates DB fetching, attribute filtering, and matcher invocation.
   This separation enables thorough unit testing of the algorithm without
   DB mocking.

2. **Reuse existing `ProviderRepository`** for attribute/auditor
   filtering via `getProvidersHostUriByAttributes` pattern, but add a
   new `BidScreeningRepository` for snapshot-with-nodes queries optimized
   for this feature.

3. **Provider-level parallelism**: Each provider's bin-packing check
   is independent. Process providers sequentially but bail out early
   on obvious mismatches (aggregate resource check before bin-packing).

4. **Auditor configuration**: Reuse the existing
   `MANAGED_WALLET_LEASE_ALLOWED_AUDITORS` config pattern from
   `BillingConfigService` for the "audited" boolean in the response.

## Complexity Tracking

No constitution violations to justify.
