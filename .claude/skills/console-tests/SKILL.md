---
name: console-tests
description: "Write tests for the akash-network/console monorepo following established team patterns and reviewer expectations. Use this skill whenever you need to write, fix, review, or refactor tests in the console project — including unit tests, functional tests, integration tests, or E2E tests for both frontend (deploy-web) and backend (api, notifications, indexer, provider-proxy). Also trigger when the user mentions 'write tests', 'add tests', 'fix tests', 'test this', 'spec file', or asks about testing patterns in the console codebase. When in doubt about whether to use this skill for a testing task in this repo, USE IT."
---

# Console Test Writing Guide

This skill encodes the testing conventions and patterns for the akash-network/console monorepo.

Before writing any test, read the source file you're testing thoroughly. Understand what it does, what dependencies it has, and what level of testing is appropriate.

## Deciding What Type of Test to Write

Choose the lowest-effective test level. Writing E2E tests for logic that can be unit tested wastes everyone's time and creates brittle, slow suites.

**Unit tests** (99% of cases):
- Components, hooks, pure logic services, utilities
- All dependencies mocked via DI (never module-level mocking)
- Run at PR level, must be fast

**Integration tests** (service + database):
- Services that rely heavily on database logic or Repository patterns
- Use real database fixtures, not mocks
- Mock only 3rd-party service calls if needed
- Good for verifying queries, transactions, and data integrity

**Functional / API tests** (black-box HTTP):
- Test the service as a black box through its HTTP endpoints
- External network calls MUST be mocked:
  - Use `nock` for HTTP clients built on Node.js `http`/`https` modules
  - Use `fetch-mock` for code paths using native Node.js `fetch` (Node 18+)
- Do NOT mock internal application services — they're implementation details at this level
- Should only fail when functional requirements change, not from refactoring
- Don't write functional tests for simple routes — test the service layer directly instead

**E2E tests** (post-deployment verification):
- Only for verifying deployed services in target environments (beta/prod)
- No mocks at all
- Happy path only
- Use Playwright with semantic locators

## Universal Rules (All Test Types)

### The `setup` Function Pattern

This is the most important convention. Never use `beforeEach` with shared mutable variables.

- Define a `setup()` function at the **bottom** of the root `describe` block
- It constructs the unit under test and returns it along with all mocked dependencies
- It accepts a **single parameter** with an **inline type definition**
- Do **not** specify the return type — let TypeScript infer it
- Each test calls `setup()` independently — no shared mutable state across tests

```typescript
describe(BalancesService.name, () => {
  it("returns balances for a given address", async () => {
    const { service, balanceRepository } = setup();
    balanceRepository.findByAddress.mockResolvedValue([{ denom: "uakt", amount: "1000" }]);

    const result = await service.getBalances("akash1abc...");

    expect(result).toEqual([{ denom: "uakt", amount: "1000" }]);
  });

  it("returns empty array when no balances found", async () => {
    const { service, balanceRepository } = setup();
    balanceRepository.findByAddress.mockResolvedValue([]);

    const result = await service.getBalances("akash1xyz...");

    expect(result).toEqual([]);
  });

  function setup(input?: { customConfig?: Partial<BalancesConfig> }) {
    const balanceRepository = mock<BalanceRepository>();
    const config = mockConfigService<BalancesConfig>({ ...input?.customConfig });
    const service = new BalancesService(balanceRepository, config);
    return { service, balanceRepository, config };
  }
});
```

Skip `setup` only if creating the object under test is trivially simple (e.g., testing a pure function with no dependencies).

### Test Description Conventions

**Root `describe`**: Use `SubjectUnderTest.name` (the actual reference, not a string). This enables IDE refactoring and reference-finding.

```typescript
// Good
describe(StripeWebhookService.name, () => { ... });

// Bad
describe("StripeWebhookService", () => { ... });
```

**Nested `describe`**: Use either a method name or a `"when ..."` condition.

```typescript
describe(StripeWebhookService.name, () => {
  describe("handleChargeRefunded", () => { ... });
  describe("when payment method is missing", () => { ... });
});
```

**`it` blocks**: Use present simple, 3rd person singular. Do NOT prepend with "should".

```typescript
// Good
it("returns early when customer ID is missing", async () => { ... });
it("updates both limits and isTrialing when endTrial is true", async () => { ... });

// Bad
it("should return early when customer ID is missing", async () => { ... });
```

### Mocking: `mock<T>()` from `vitest-mock-extended`

Always use `mock<T>()` for typed mocks. Never use `jest.mock()` or `vi.mock()` for module-level mocking — it causes OOM with heavy component trees and couples tests to implementation details.

```typescript
import { mock } from "vitest-mock-extended";

const userRepository = mock<UserRepository>();
const stripeService = mock<StripeService>();
const logger = mock<LoggerService>();
```

For config services, use `mockConfigService<T>()` (in `apps/api/test/mocks/config-service.mock.ts`):

```typescript
const billingConfig = mockConfigService<BillingConfigService>({
  DEPLOYMENT_GRANT_DENOM: "uakt",
  TRIAL_ALLOWANCE_EXPIRATION_DAYS: 14
});
```

### Vitest Imports

Most apps use `globals: false`. Explicitly import from `vitest`:

```typescript
import { describe, expect, it, vi } from "vitest";
```

Exception: `apps/api` uses `globals: true`, so imports are optional there.

### No `if` Statements in Assertions

Never use conditional logic in test expectations. If you need to narrow a type, use `as` assertions. Otherwise, skipped assertions silently pass when they shouldn't.

```typescript
// Good
const result = await service.validate(cert) as CertValidationResultError;
expect(result.ok).toBe(false);
expect(result.code).toBe("unknownCertificate");

// Bad
const result = await service.validate(cert);
if (!result.ok) {
  expect(result.code).toBe("unknownCertificate");
}
```

### Arrange-Act-Assert (AAA)

Follow the AAA pattern. Setup prepares state; the test validates it. Don't mix concerns.

```typescript
it("creates a deployment grant", async () => {
  // Arrange
  const { service, grantService } = setup();
  grantService.create.mockResolvedValue(mockGrant);

  // Act
  const result = await service.createGrant("akash1abc...");

  // Assert
  expect(result).toEqual(mockGrant);
  expect(grantService.create).toHaveBeenCalledWith("akash1abc...");
});
```

### Comments Answer WHY, Not WHAT

Remove obvious comments. If a comment just restates the method name or assertion, delete it.

### Only Test What the Code Handles

Don't write tests for error paths that don't exist in the production code. If the service doesn't catch a specific error, don't test for it.

## Frontend Tests (deploy-web)

Read `references/frontend-patterns.md` for the full set of frontend-specific patterns including the DEPENDENCIES/COMPONENTS pattern, hook testing, query testing, and container testing.

Key points:
- Use `getBy*` for presence assertions (`toBeInTheDocument()`), and `queryBy*` for absence assertions (`not.toBeInTheDocument()`)
- Use the `DEPENDENCIES` export + `dependencies` prop for component DI (never `vi.mock`)
- Use `MockComponents()` helper to auto-mock child components
- Services are injected via `useServices` hook, not via `DEPENDENCIES` prop
- Use `setupQuery()` utility for React Query hook tests
- Use `renderHook` from `@testing-library/react` for hook tests

## API Unit Tests

Read `references/api-patterns.md` for the full set of API-specific patterns including service testing, config mocking, and seeder patterns.

Key points:
- Construct services manually with `mock<T>()` dependencies
- Use seeders for test data (`apps/api/test/seeders/`)
- Prefer function-based seeders over class-based ones (simpler to write and use)
- Use `@faker-js/faker` for randomized data in seeders
- Seeder accepts `Partial<T>` overrides with sensible defaults

## API Functional Tests

Read `references/api-patterns.md` for functional test setup details.

Key points:
- Each spec file gets its own database via `TestDatabaseService` (auto-created, migrated, dropped)
- Use real DI container (`tsyringe`) to resolve services
- Mock external HTTP calls with `nock`, not internal services
- Test through HTTP endpoints using `app.request()` (Hono) or `supertest` (NestJS)
- Use existing seeders to create test fixtures in the real database
- Write race condition tests for upsert operations

## Notifications Tests (NestJS)

- Use `@nestjs/testing` `Test.createTestingModule()` for DI
- Use `MockProvider()` helper to create NestJS providers with `vitest-mock-extended` mocks
- Functional tests use `supertest` with a real NestJS app and per-file test databases

## E2E / Playwright Tests

- Use semantic locators: `getByRole`, `getByLabel`, `getByPlaceholder` — never CSS selectors or `data-testid`
- `getByRole('button', { name: /Submit/ })` — don't add redundant `aria-label` to buttons that already have text
- Page Objects abstract UI interactions but must NOT contain assertions
- Use `waitFor(...)` instead of `setTimeout` — timeouts cause flakiness
- No `console.log` or manual screenshots — use Playwright's built-in traces (`npx playwright --ui`)
- No randomness in test data — it causes flaky failures
- Use `Promise.all` with `context.waitForEvent("page")` for navigation patterns

## Test File Organization

- Test files are co-located with source: `my-service.ts` → `my-service.spec.ts`
- Frontend: `*.spec.tsx` for components, `*.spec.ts` for logic
- API unit: `src/**/*.spec.ts`
- API integration: `src/**/*.integration.ts`
- API functional: `test/functional/**/*.spec.ts`
- API e2e: `test/e2e/**/*.spec.ts`
- Seeders: `test/seeders/` in each app
