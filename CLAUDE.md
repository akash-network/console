# Contribution Guidelines

This file aggregates all RFC (Request for Comments) contribution guidelines that have landed.

## General Project Description

This is a **monorepo** project using **npm workspaces**. All projects use **strict TypeScript** configuration (`"strict": true` in all `tsconfig.json` files), ensuring type safety across the entire codebase.

### Project Structure

The monorepo contains multiple applications and shared packages:

**Applications:**
- `apps/api` - Hono + OpenAPI REST API with tsyringe DI
- `apps/deploy-web` - Next.js frontend for deploying on Akash Network
- `apps/stats-web` - Next.js frontend for network statistics
- `apps/indexer` - Node.js blockchain indexer (Express, no DI)
- `apps/notifications` - NestJS service for handling notifications (NestJS built-in DI)
- `apps/log-collector` - Standalone log collector (vanilla Node.js + tsyringe)
- `apps/provider-proxy` - Hono service for proxying requests to providers (manual factory DI)
- `apps/provider-console` - Provider console application
- `apps/tx-signer` - Internal transaction signing service (Hono + tsyringe)

**Shared Packages:**
- `packages/database` - Database shared package (Drizzle ORM schemas)
- `packages/dev-config` - Shared ESLint, TypeScript, and Prettier configs
- `packages/docker` - Docker build utilities
- `packages/env-loader` - Environment variable loading (uses `@dotenvx/dotenvx`)
- `packages/http-sdk` - HTTP client SDK
- `packages/instrumentation` - OpenTelemetry instrumentation setup
- `packages/logging` - Logging utilities (Pino-based `LoggerService`)
- `packages/net` - Blockchain Network utilities
- `packages/network-store` - Network state management
- `packages/react-query-proxy` - React Query wrapper utilities
- `packages/react-query-sdk` - React Query SDK for console services
- `packages/releaser` - Release management utilities
- `packages/ui` - Shared UI components

### Tech Stack

- **Node.js**: >= 24.14.1 (enforced via Volta)
- **Package Manager**: npm 11.11.0
- **Framework**: Next.js 14.x, Hono, Nest.js
- **Database**: PostgreSQL with Drizzle ORM and legacy sequelize
- **Monorepo**: npm workspaces
- **Testing**: Vitest (primary), Jest (legacy in indexer & provider-console), Playwright (e2e), React Testing Library
- **Styling**: Material-UI, Emotion, Tailwind CSS
- **State**: React Query, Jotai
- **Blockchain**: Cosmos, Akash network

### Building the Project

#### Using Docker Compose (Recommended for Development)

Build production images:
```bash
npm run dc:build
```

Run services in development mode:
```bash
npm run dc:up:dev
```

Run specific service with dependencies:
```bash
npm run dc:up:dev -- deploy-web
```

Stop all services:
```bash
npm run dc:down
```

#### Building Individual Applications

Each application has its own build script. Navigate to the app directory and run:
```bash
cd apps/<app-name>
npm run build
```

### Running Tests

IMPORTANT: Before pushing, ALWAYS run in the affected app:
1. `npm test` (runs unit, integration, and functional tests)
2. `npm run lint -- --quiet`
3. `npx tsc --noEmit`

#### Unit Tests

All applications and packages use **Vitest** for unit testing.

**In applications:**
```bash
# Run all unit tests
cd apps/<app-name>
npm run test:unit

# Run with watch mode
npm run test:unit -- --watch
```

**In packages:**
```bash
# Run tests for all packages
npm run test -w ./packages

# Run tests for a specific package
cd packages/<package-name>
npm test
```

#### Integration Tests

Integration tests run against real infrastructure (database, etc.) and are currently used in `apps/api`.

- **Naming**: `*.integration.ts` (colocated next to source files, like unit tests)
- **Running**:
  ```bash
  cd apps/api
  npm run test:integration
  ```
- **Setup**: Requires Docker services running via `npm run test:ci-setup`
- **Vitest project**: Configured as a separate `integration` project in `vitest.config.ts` with its own setup files and extended timeouts (60s test, 30s hook)

#### Functional Tests

Functional tests are available in `apps/api`, `apps/notifications`, `apps/provider-proxy`:

```bash
cd apps/<app-name>
npm run test:functional

# With watch mode
npm run test:functional -- --watch
```

**CI Setup/Teardown for Functional Tests:**

Some services require Docker services to be running before functional tests can execute. These services provide `test:ci-setup` and `test:ci-teardown` scripts:

- **`apps/api`**:
  ```bash
  cd apps/api
  npm run test:ci-setup    # Start required Docker services
  npm run test:functional # Run functional tests
  npm run test:ci-teardown # Stop Docker services
  ```

- **`apps/notifications`**:
  ```bash
  cd apps/notifications
  npm run test:ci-setup     # Start database service
  npm run test:functional  # Run functional tests
  npm run test:ci-teardown # Stop Docker services
  ```

These scripts use Docker Compose (`dc`) to manage test dependencies. The setup script starts services in detached mode (`-d`), and teardown stops all services.

#### End-to-End (E2E) Tests

E2E tests are available in `apps/api`, `apps/deploy-web`, `apps/provider-proxy`:

```bash
cd apps/deploy-web
npm run test:e2e
```

E2E tests in deploy-web require:
- Playwright browsers installed: `npx playwright install`
- Test environment variables configured in `env/.env.test` file (see app-specific documentation)

#### Running All Tests

To run both unit and functional tests together:
```bash
cd apps/<app-name>
npm test
```

### TypeScript Configuration

All projects use **strict TypeScript** with the following key settings:
- `"strict": true` - Enables all strict type checking options
- `"noImplicitAny": true` - Prevents implicit `any` types
- Type checking is enforced via `validate:types` scripts in packages

**Type checking packages:**
```bash
# Check all packages
npm run validate:types -w ./packages

# Check specific package
cd packages/<package-name>
npm run validate:types
```

**Type checking applications:**
```bash
cd apps/<app-name>
# or
npx tsc --noEmit
```

### Linting

The project uses **ESLint** with a shared configuration from `packages/dev-config`. All code is automatically linted on commit via `lint-staged` and `husky`.

#### Running Linting

**From the root:**
```bash
# Lint entire monorepo
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

**In individual applications/packages:**
```bash
cd apps/<app-name>
npm run lint

# Most apps also support auto-fix
npm run lint -- --fix
```

#### Linting Configuration

- **Base config**: `packages/dev-config/.eslintrc.base.js` - Common rules for all projects
- **TypeScript config**: `packages/dev-config/.eslintrc.ts.js` - TypeScript-specific rules
- **Next.js config**: `packages/dev-config/.eslintrc.next.js` - Next.js-specific rules for web apps
- **Root config**: `.eslintrc.js` - Monorepo-wide overrides

##### Key Linting Rules

- **Import sorting**: Enforced via `eslint-plugin-simple-import-sort`
- **Import validation**: `eslint-plugin-import-x` checks for:
  - Extraneous dependencies
  - Circular dependencies
  - Self-imports
  - Useless path segments
- **TypeScript**: Enforces consistent type imports and warns on `any` types
- **Custom rules**: `eslint-plugin-akash` includes project-specific rules (e.g., `akash/no-mnemonic`)

### Commits

The project uses **semantic release** with **conventional commits** for automated versioning and changelog generation. All commit messages **must comply with the rules defined in `commitlintrc.json`**.

## Dependency Injection

Most backend apps use **tsyringe** for DI. The exception is `apps/notifications` (NestJS built-in DI) and `apps/indexer` (no DI — direct imports).

- Use `@singleton()` for stateless services, `@scoped(Lifecycle.ResolutionScoped)` for request-scoped services
- Register providers in `src/providers/` files that are imported for side effects during bootstrap
- Resolve services from the container via `container.resolve(ServiceClass)` in route handlers

## Routing Pattern (apps/api)

Routes use **Hono** with `@hono/zod-openapi` for type-safe, OpenAPI-documented endpoints:

```typescript
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const myRouter = new OpenApiHonoHandler();

const myRoute = createRoute({
  method: "get",
  path: "/v1/example",
  tags: ["Example"],
  security: SECURITY_BEARER_OR_API_KEY,
  responses: { 200: { description: "Success", content: { "application/json": { schema: MyResponseSchema } } } }
});

myRouter.openapi(myRoute, async function routeGetExample(c) {
  return c.json(await container.resolve(MyController).getExample(), 200);
});
```

- Always use `createRoute` from `@src/core/lib/create-route/create-route` (wraps `@hono/zod-openapi` with cache-control and body-limit middleware)
- Always use `OpenApiHonoHandler` (wraps `OpenAPIHono` with centralized error handling)
- Route handlers resolve controllers from the tsyringe container
- Error responses use the `http-errors` package, not custom error classes

## Data Access (apps/api)

- Repositories extend `BaseRepository<T, Input, Output>` from `@src/core/repositories/base.repository`
- Built-in CRUD, pagination, CASL ability-based row filtering, and Drizzle ORM transaction support
- Use `DrizzleAbility` for authorization at the data layer

## Path Aliases

All backend apps use these TypeScript path aliases (defined in `tsconfig.build.json`):
- `@src/*` → `./src/*`
- `@test/*` → `./test/*`

## Test File Conventions

- **Naming**: `*.spec.ts` (not `*.test.ts`)
- **Location**: Colocated next to source files (not in `__tests__/` directories)
- **Mocking**: Use `vitest-mock-extended` (`mock()`, `MockProxy<T>`)
- **Environment**: `@akashnetwork/env-loader` loads vars from `env/.env.*.test` files

## `setup` function instead of `beforeEach` in unit & service level tests

See detailed guidelines:
@./.claude/instructions/setup-function-instead-of-beforeeach-in-unit-service-level-tests.md

## Use `LoggerService` instead of `console.log/warn/error`

See detailed guidelines:
@./.claude/instructions/use-logger-service-instead-of-console.md

## Commit and PR Conventions

See detailed guidelines:
@./.claude/instructions/commit-and-pr-conventions.md

## Writing Tests

Always use the `/console-tests` skill when writing, fixing, reviewing, or refactoring tests in this repo.
