<!--
Sync Impact Report
==================
Version change: N/A → 1.0.0 (initial ratification)
Modified principles: N/A (first version)
Added sections:
  - Core Principles (7): Type Safety, SOLID Design, Test Coverage,
    Transaction Safety, Concurrency Vigilance, Structured Observability,
    OpenAPI-First Contracts
  - Technology & Architecture Constraints
  - Development Workflow & Quality Gates
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ compatible (Constitution Check
    section already references constitution gates)
  - .specify/templates/spec-template.md — ✅ compatible (requirements and
    success criteria sections align with principles)
  - .specify/templates/tasks-template.md — ✅ compatible (phase structure
    supports test-first and incremental delivery)
Follow-up TODOs: none
-->

# Akash Network Console Constitution

## Core Principles

### I. Strict Type Safety (NON-NEGOTIABLE)

All projects MUST use `"strict": true` in their TypeScript configuration.
No implicit `any` types are permitted. Every function boundary, API
contract, and dependency injection registration MUST be explicitly typed.
Type narrowing MUST be preferred over type assertions. The type checker
(`tsc --noEmit`) MUST pass with zero errors before any code is merged.

**Rationale**: Strict typing catches entire categories of runtime errors
at compile time and serves as living documentation of data flow across
the monorepo's many services.

### II. SOLID Design & Acyclic Dependencies

All modules and classes MUST follow SOLID principles:

- **Single Responsibility**: Each class/module owns exactly one reason
  to change.
- **Open/Closed**: Extend behavior through composition or abstraction,
  not by modifying existing implementations.
- **Liskov Substitution**: Subtypes MUST be substitutable for their
  base types without altering correctness.
- **Interface Segregation**: Depend on narrow, focused interfaces
  rather than broad ones.
- **Dependency Inversion**: Depend on abstractions, not concretions.

Cyclic module dependencies are prohibited. Type-only import cycles are
acceptable where structurally unavoidable, but MUST be documented.
New abstractions MUST be justified by more than one consumer — do not
create speculative interfaces.

**Rationale**: SOLID design keeps a large monorepo maintainable as
teams and services grow. Acyclic dependencies ensure predictable build
order and prevent cascading breakage.

### III. Test-Covered Changes (NON-NEGOTIABLE)

Every code change MUST include corresponding tests. Coverage targets
are enforced per application via Codecov:

| Application | Project Target | Patch Target |
|-------------|---------------|-------------|
| api | 75% | 80% |
| deploy-web | 40% | 50% |
| notifications | 80% | 80% |
| provider-proxy | 80% | 80% |

Coverage regressions block merge. Tests MUST be colocated next to
source files as `*.spec.ts`. The `setup()` function pattern MUST be
used instead of `beforeEach` in unit and service-level tests.

**Rationale**: Tests are the safety net that enables confident
refactoring across a multi-app monorepo. Coverage gates prevent
gradual erosion of test quality.

### IV. Transaction Safety & Atomicity

External service calls (HTTP, RPC, message queues, blockchain
transactions) MUST NEVER occur inside a database transaction. Business
operations MUST be atomic — if a multi-step mutation cannot be fully
rolled back within the database, use the saga or compensation pattern.
Side effects MUST be separated from data mutations.

**Rationale**: Mixing I/O with database transactions risks holding
locks during network latency, causing connection pool exhaustion and
cascading failures. Atomic boundaries make failure modes explicit and
recoverable.

### V. Concurrency & Performance Vigilance

Guard against race conditions on shared state — use appropriate
locking, queuing, or optimistic concurrency control for contested
resources. CPU-intensive work MUST NOT block the Node.js event loop;
offload to worker threads or chunk into incremental steps. Fragile
timing assumptions MUST be identified and documented. Performance-
critical paths MUST be profiled before optimization.

**Rationale**: A blockchain-facing platform handles concurrent
provider interactions, wallet operations, and indexing. Unguarded
concurrency causes data corruption; event loop blocking causes
cascading request timeouts.

### VI. Structured Observability

`LoggerService` (Pino-based) MUST be used for all logging — never
`console.log`, `console.warn`, `console.error`, or `console.info`.
Log entries MUST be structured objects containing an `event` field for
filtering and aggregation. OpenTelemetry instrumentation MUST be used
for cross-service tracing. Error logs MUST include sufficient context
(request ID, entity IDs, operation name) to reproduce the issue.

**Rationale**: Structured logging enables machine-parseable alerting
and dashboarding. Unstructured console output is invisible to
observability tooling in production.

### VII. OpenAPI-First API Contracts

All API endpoints MUST be defined via `createRoute` and
`OpenApiHonoHandler` with Zod schemas. Request and response types
MUST be derived from the schema — manual type duplication is
prohibited. Error responses MUST use the `http-errors` package, not
custom error classes. The generated OpenAPI spec is the contract
between frontend and backend.

**Rationale**: Schema-driven APIs ensure frontend and backend stay in
sync, enable automatic client generation, and provide self-documenting
endpoints.

## Technology & Architecture Constraints

- **Runtime**: Node.js >= 24.14.1 (enforced via Volta), npm 11.11.0
- **Language**: Strict TypeScript across all applications and packages
- **Database**: PostgreSQL with Drizzle ORM (primary). Sequelize is
  legacy and MUST NOT be extended to new features.
- **Data Access**: `BaseRepository` pattern with CASL ability-based
  row-level authorization at the data layer
- **Dependency Injection**: tsyringe — `@singleton()` for stateless
  services, `@scoped(Lifecycle.ResolutionScoped)` for request-scoped.
  Providers registered in `src/providers/`. Exceptions: NestJS built-in
  DI in `apps/notifications`, no DI in `apps/indexer`.
- **Commits**: Conventional commits enforced via commitlint. Scope
  MUST be from the allowed list in `.commitlintrc.json`.
- **Monorepo**: npm workspaces. Shared ESLint, TypeScript, and
  Prettier configuration from `packages/dev-config`. Path aliases
  `@src/*` → `./src/*` and `@test/*` → `./test/*` in backend apps.
- **Environment**: `@dotenvx/dotenvx` via `packages/env-loader`.
  Secrets MUST NOT be committed; use `env/.env.*.test` for test
  environments only.

## Development Workflow & Quality Gates

- **Pre-push gate**: Every affected app MUST pass `npm test`,
  `npm run lint -- --quiet`, and `npx tsc --noEmit` before push.
- **Pre-commit**: lint-staged + husky enforce formatting automatically.
- **Branch naming**: `(feat|fix|refactor|chore|docs|test)/<scope>-<descriptive-slug>`
  where scope aligns with `.commitlintrc.json` when applicable.
- **Pull requests**: MUST use the template from
  `.github/pull_request_template.md`. Linear issue references use
  correct magic keywords (`closes` for done-on-merge, `ref` for
  partial work).
- **Coverage enforcement**: Codecov checks run on every PR. Patch
  coverage failures block merge per the targets in Principle III.
- **Code review**: Reviewers MUST verify compliance with this
  constitution. Violations MUST be flagged, not silently approved.

## Governance

This constitution is the authoritative source of engineering
principles for the Akash Network Console project. It supersedes
ad-hoc conventions and informal agreements where conflicts arise.

**Amendments**: Any change to this constitution MUST be submitted as a
pull request with a clear rationale. The version number MUST be bumped
following semantic versioning:
- MAJOR: Principle removed or fundamentally redefined
- MINOR: New principle or section added, or material expansion
- PATCH: Clarifications, wording improvements, non-semantic changes

**Runtime guidance**: `CLAUDE.md` serves as the runtime development
guidance file and MUST remain consistent with this constitution.

**Compliance**: Reviewed during code review. Reviewers are expected to
flag principle violations. Repeated non-compliance should trigger a
team discussion, not silent workarounds.

**Version**: 1.0.0 | **Ratified**: 2026-04-27 | **Last Amended**: 2026-04-27
