# General Project Description

This is a **monorepo** project using **npm workspaces** and **Turbo** for build orchestration. All projects use **strict TypeScript** configuration (`"strict": true` in all `tsconfig.json` files), ensuring type safety across the entire codebase.

## Project Structure

The monorepo contains multiple applications and shared packages:

**Applications:**
- `apps/deploy-web` - Next.js frontend for deploying on Akash Network
- `apps/stats-web` - Next.js frontend for network statistics
- `apps/api` - Node.js API providing data to the deploy website
- `apps/indexer` - Node.js service that indexes Akash blockchain data
- `apps/provider-proxy` - Node.js service for proxying requests to providers
- `apps/notifications` - NestJS service for handling notifications
- `apps/log-collector` - standalone service for collecting logs
- `apps/provider-console` - Provider console application

**Shared Packages:**
- `packages/ui` - Shared UI components
- `packages/http-sdk` - HTTP client SDK
- `packages/database` - Database shared package
- `packages/logging` - Logging utilities
- `packages/net` - Blockchain Network utilities
- `packages/network-store` - Network state management
- `packages/react-query-sdk` - React Query SDK for console services

## Tech Stack

- **Node.js**: >= 24.13.0 (enforced via Volta)
- **Package Manager**: npm 11.6.2
- **Framework**: Next.js 14.x, Hono, Nest.js
- **Database**: PostgreSQL with Drizzle ORM and legacy sequelize
- **Monorepo**: Turborepo, npm workspaces
- **Testing**: Jest (unit and functional), Playwright (e2e), React Testing Library
- **Styling**: Material-UI, Emotion, Tailwind CSS
- **State**: React Query, Jotai
- **Blockchain**: Cosmos, Akash network

## Building the Project

### Using Docker Compose (Recommended for Development)

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

### Using Turbo Repo

Run applications in development mode:
```bash
npm run console:dev      # Run console UI with dependencies
npm run stats:dev        # Run stats UI with dependencies
npm run api:dev          # Run API with dependencies
npm run indexer:dev      # Run indexer with dependencies
```

Run without database dependencies:
```bash
npm run console:dev:no-db
npm run stats:dev:no-db
```

### Building Individual Applications

Each application has its own build script. Navigate to the app directory and run:
```bash
cd apps/<app-name>
npm run build
```

## Running Tests

### Unit Tests

All applications and packages use **Jest** for unit testing.

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

### Functional Tests

Functional tests are available in `apps/api`, `apps/notifications`, `apps/provider-proxy`:

```bash
cd apps/<app-name>
npm run test:functional

# With watch mode
npm run test:functional -- --watch
```

**CI Setup/Teardown for Functional Tests:**

Some services require Docker services to be running before functional tests can execute. These services provide `test:ci-setup` and `test:ci-teardown` scripts:

- **`apps/api`**: Requires `db`, `mock-oauth2-server`, and `provider-proxy` services
  ```bash
  cd apps/api
  npm run test:ci-setup    # Start required Docker services
  npm run test:functional # Run functional tests
  npm run test:ci-teardown # Stop Docker services
  ```

- **`apps/notifications`**: Requires `db` service
  ```bash
  cd apps/notifications
  npm run test:ci-setup     # Start database service
  npm run test:functional  # Run functional tests
  npm run test:ci-teardown # Stop Docker services
  ```

These scripts use Docker Compose (`dc`) to manage test dependencies. The setup script starts services in detached mode (`-d`), and teardown stops all services.

### End-to-End (E2E) Tests

E2E tests use **Playwright** and are available in `apps/api`, `apps/deploy-web`, `apps/provider-proxy`:

```bash
cd apps/deploy-web
npm run test:e2e
```

E2E tests in deploy-web require:
- Playwright browsers installed: `npx playwright install`
- Test environment variables configured in `env/.env.test` file (see app-specific documentation)

### Running All Tests

To run both unit and functional tests together:
```bash
cd apps/<app-name>
npm test
```

## TypeScript Configuration

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

## Linting

The project uses **ESLint** with a shared configuration from `packages/dev-config`. All code is automatically linted on commit via `lint-staged` and `husky`.

### Running Linting

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

### Linting Configuration

- **Base config**: `packages/dev-config/.eslintrc.base.js` - Common rules for all projects
- **TypeScript config**: `packages/dev-config/.eslintrc.ts.js` - TypeScript-specific rules
- **Next.js config**: `packages/dev-config/.eslintrc.next.js` - Next.js-specific rules for web apps
- **Root config**: `.eslintrc.js` - Monorepo-wide overrides

#### Key Linting Rules

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
