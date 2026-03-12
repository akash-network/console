# API Testing Patterns (apps/api, apps/notifications)

## Table of Contents
1. [Unit Test Pattern](#unit-test-pattern)
2. [Config Service Mocking](#config-service-mocking)
3. [Logger Mocking](#logger-mocking)
4. [Seeders](#seeders)
5. [Functional Test Setup](#functional-test-setup)
6. [Functional Test Pattern](#functional-test-pattern)
7. [Integration Test Pattern](#integration-test-pattern)
8. [NestJS Tests (Notifications)](#nestjs-tests-notifications)
9. [Assertion Patterns](#assertion-patterns)

## Unit Test Pattern

Construct the service under test manually, passing `vitest-mock-extended` mocks for all dependencies. Always use the `setup()` function at the bottom of the root `describe`.

```typescript
import { mock } from "vitest-mock-extended";

describe(TopUpManagedDeploymentsService.name, () => {
  it("tops up wallets below threshold", async () => {
    const { service, drainingDeploymentService } = setup();
    drainingDeploymentService.findAll.mockResolvedValue([mockDeployment]);

    await service.topUp();

    expect(drainingDeploymentService.findAll).toHaveBeenCalled();
  });

  function setup(input?: { grantDenom?: string }) {
    const managedSignerService = mock<ManagedSignerService>();
    const billingConfig = mockConfigService<BillingConfigService>({
      DEPLOYMENT_GRANT_DENOM: input?.grantDenom ?? "uakt"
    });
    const drainingDeploymentService = mock<DrainingDeploymentService>();
    const logger = mock<LoggerService>();

    const service = new TopUpManagedDeploymentsService(
      managedSignerService,
      billingConfig,
      drainingDeploymentService,
      logger
    );

    return { service, managedSignerService, billingConfig, drainingDeploymentService, logger };
  }
});
```

The setup function returns ALL mocked dependencies so tests can configure them individually.

## Config Service Mocking

Use `mockConfigService<T>()` from `apps/api/test/mocks/config-service.mock.ts`. It creates a typed mock where `get(key)` returns provided values or throws for unmocked keys.

```typescript
import { mockConfigService } from "@test/mocks/config-service.mock";

const billingConfig = mockConfigService<BillingConfigService>({
  DEPLOYMENT_GRANT_DENOM: "uakt",
  TRIAL_ALLOWANCE_EXPIRATION_DAYS: 14
});
```

## Logger Mocking

Use `mock<LoggerService>()` for unit tests:

```typescript
const logger = mock<LoggerService>();
```

When verifying log calls, check for structured event objects:

```typescript
expect(logger.info).toHaveBeenCalledWith(
  expect.objectContaining({
    event: "POD_DISCOVERY_COMPLETED",
    namespace: "test-ns",
    totalPods: 5
  })
);
```

## Seeders

Seeders generate test data with sensible defaults and `Partial<T>` overrides. Prefer function-based seeders.

### Function-based seeder (preferred for new code)

```typescript
import { faker } from "@faker-js/faker";

export function createUserWallet(overrides: Partial<UserWalletOutput> = {}): UserWalletOutput {
  return {
    id: faker.number.int({ min: 0, max: 1000 }),
    userId: faker.string.uuid(),
    address: createAkashAddress(),
    creditAmount: faker.number.int({ min: 0, max: 100000000 }),
    isTrialing: false,
    deploymentAllowance: faker.number.int({ min: 0, max: 100000000 }),
    feeAllowance: faker.number.int({ min: 0, max: 100000000 }),
    ...overrides
  };
}
```

### Class-based seeder (legacy, still in use)

```typescript
export class AutoTopUpDeploymentSeeder {
  static create(overrides: Partial<AutoTopUpDeployment> = {}): AutoTopUpDeployment {
    return {
      id: faker.string.uuid(),
      walletId: faker.number.int(),
      dseq: faker.number.int().toString(),
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<AutoTopUpDeployment> = {}): AutoTopUpDeployment[] {
    return Array.from({ length: count }, () => AutoTopUpDeploymentSeeder.create(overrides));
  }
}
```

### Seeder rules
- Seeders live in `test/seeders/` within each app
- Share seeders across unit and functional tests
- Use `@faker-js/faker` for randomized defaults
- Don't use conditional defaults that silently ignore `null`/`undefined` values
- When you need a seeder, check if one already exists before creating a new one

## Functional Test Setup

Functional tests use a shared setup that creates per-file test databases.

### How it works (`apps/api/test/setup-functional-tests.ts`)

1. **Before all**: Creates a dedicated test database (unique name per spec file via UUID), runs Drizzle migrations
2. **Between tests**: Clears cache
3. **After all**: Drops the test database

The setup registers `RAW_APP_CONFIG` in the `tsyringe` container and provides custom matchers (`toBeTypeOrNull`, `dateTimeZ`).

### `TestDatabaseService` (`apps/api/test/services/test-database.service.ts`)

- Generates unique DB names: `test_<uuid>_<filename>`
- Creates both a user DB and an indexer DB
- Runs Drizzle ORM migrations
- Drops both databases on teardown

## Functional Test Pattern

Functional tests resolve real services from the DI container, use real databases, and mock only external HTTP calls.

```typescript
import { container } from "tsyringe";
import nock from "nock";

describe("Wallets Refill", () => {
  const walletController = container.resolve(WalletController);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);

  it("refills wallets below threshold", async () => {
    // Seed data in real DB
    const wallet = await db.insert(userWalletsTable).values({
      userId: user.id,
      address: createAkashAddress(),
      creditAmount: 100
    }).returning();

    // Mock external blockchain calls
    nock(config.REST_API_NODE_URL)
      .get(/\/cosmos\/feegrant\//)
      .reply(200, FeeAllowanceResponseSeeder.create());

    // Act through HTTP endpoint
    const response = await app.request("/v1/wallets/refill", { method: "POST" });

    // Assert
    expect(response.status).toBe(200);
  });
});
```

### Key functional test rules

- **Hit real endpoints**: Use `app.request()` (Hono) or `supertest` (NestJS), not direct service calls
- **Minimal mocking**: Only mock external 3rd-party services (blockchain nodes, Stripe, Auth0)
- **Mock via request interception**: Use `nock` for HTTP mocking, or mock at the SDK level (`ManagementClient`)
- **Seed data**: Use seeders and real DB inserts, never comment out test code
- **Don't duplicate setup**: Use `setup-functional-tests.ts` — don't recreate DB setup per file
- **Race condition tests**: Write them for upsert operations — concurrent requests hitting the same row is common

### `AppHttpService` (`apps/api/test/services/app-http.service.ts`)

A helper that wraps `app.request()` and returns both response and parsed JSON:

```typescript
const { response, body } = await appHttp.get("/v1/blocks");
expect(response.status).toBe(200);
```

## Integration Test Pattern

Integration tests verify service behavior with real database fixtures. They sit between unit tests (all mocked) and functional tests (HTTP endpoints).

```typescript
// File: src/user/services/user.service.integration.ts
describe(UserService.name, () => {
  it("cleans up stale anonymous users", async () => {
    // Seed real data
    await db.insert(usersTable).values([
      { id: "user-1", createdAt: daysBefore(30), type: "anonymous" },
      { id: "user-2", createdAt: daysBefore(5), type: "anonymous" }
    ]);

    const service = container.resolve(UserService);
    await service.cleanupStaleAnonymousUsers();

    // Verify against real DB
    const remaining = await db.select().from(usersTable);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("user-2");
  });
});
```

Use integration tests when:
- Testing services that heavily rely on database logic
- Testing Repository patterns (unit testing pure delegation adds little value)
- Verifying complex queries, transactions, or cascading operations

## NestJS Tests (Notifications)

### Unit tests with `@nestjs/testing`

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { MockProvider } from "@test/mocks/provider.mock";

describe(ChainAlertService.name, () => {
  it("evaluates conditions against alert", async () => {
    const { service, alertRepository } = await setup();
    alertRepository.findById.mockResolvedValue(mockAlert);

    await service.evaluate("alert-1");

    expect(alertRepository.findById).toHaveBeenCalledWith("alert-1");
  });

  async function setup() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainAlertService,
        TemplateService,
        MockProvider(AlertRepository),
        MockProvider(ConditionsMatcherService),
        MockProvider(LoggerService)
      ]
    }).compile();

    return {
      service: module.get<ChainAlertService>(ChainAlertService),
      alertRepository: module.get<MockProxy<AlertRepository>>(AlertRepository)
    };
  }
});
```

### `MockProvider` utility (`apps/notifications/test/mocks/provider.mock.ts`)

```typescript
import { mock } from "vitest-mock-extended";

export const MockProvider = <T>(token: InjectionToken<T>, override?: Partial<T>): Provider => {
  return { provide: token, useValue: mock<T>(override) };
};
```

### Functional tests with `supertest`

```typescript
import request from "supertest";

const res = await request(app.getHttpServer())
  .post("/v1/alerts")
  .set("x-user-id", userId)
  .send({ data: input });

expect(res.status).toBe(201);
```

## Assertion Patterns

### Use `expect.objectContaining` for partial matching

```typescript
expect(callback).toHaveBeenCalledWith(
  expect.objectContaining({ podName: "pod-2" }),
  expect.any(AbortSignal)
);
```

### Use `expect.arrayContaining` instead of `.every()` loops

```typescript
// Good
expect(actualIds).toEqual(expect.arrayContaining(expectedIds));

// Bad
expectedIds.every(id => expect(actualIds).toContain(id));
```

### Verify idempotency with "not called" expectations

```typescript
it("handles duplicate webhook delivery idempotently", async () => {
  // ... setup already-processed state

  await service.handleChargeRefunded(event);

  expect(repository.updateById).not.toHaveBeenCalled();
  expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
});
```

### Generate sensitive test data explicitly

Don't hardcode mnemonics or secrets in config — generate them in tests:

```typescript
const mnemonic = generateMnemonic();
```
