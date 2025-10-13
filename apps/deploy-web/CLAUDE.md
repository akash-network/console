# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the deploy-web application.

## Application Overview

The deploy-web app is the main Akash Console UI - a Next.js 14 application that allows users to deploy Docker containers on the Akash Network. It handles wallet connections (Keplr, Leap, etc.), OAuth2 authentication, SDL template editing, deployment creation, lease management, and billing.

**Tech Stack**: Next.js 14 (Pages Router), Material-UI, Emotion, React Query, Jotai, TypeScript, Playwright (e2e), Jest (unit)

## Project Structure

```
apps/deploy-web/
├── src/
│   ├── components/      # React components (Material-UI based)
│   ├── pages/          # Next.js pages
│   ├── hooks/          # Custom React hooks
│   ├── queries/        # React Query hooks and API clients
│   ├── context/        # React Context providers
│   ├── services/       # Business logic and services
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript types
│   ├── config/         # Configuration files
│   ├── chains/         # Chain/network definitions
│   ├── store/          # Jotai atoms for state management
│   └── lib/            # Third-party library wrappers
├── tests/
│   ├── ui/             # Playwright e2e tests
│   │   ├── fixture/    # Playwright fixtures (wallet setup, browser context)
│   │   ├── pages/      # Page Object Models
│   │   ├── actions/    # Reusable test actions
│   │   └── uiState/    # UI state helpers
│   ├── unit/           # Unit test helpers
│   ├── seeders/        # Test data seeders
│   └── mocks/          # Mock data
├── env/                # Environment files (.env.test, .env.sample, etc.)
└── playwright.config.ts
```

## Commands

### Development
```bash
npm run dev                 # Start Next.js dev server (requires DB + API)
npm run console:dev         # From root: starts console + API + provider-proxy
npm run console:dev:no-db   # From root: starts without Docker DB
```

### Testing
```bash
# Unit Tests (Jest + React Testing Library)
npm run test:unit           # Run all unit tests
npm run test:cov            # Run tests with coverage

# E2E Tests (Playwright)
npm run test:e2e            # Run Playwright tests
npx playwright test --ui    # Run with UI mode
npx playwright test --debug # Run with debugger
npx playwright show-report  # View HTML report after test run
```

### Build & Lint
```bash
npm run build              # Build for production
npm run build-env-schemas  # Compile env config schema
npm run start              # Start production server
npm run type-check         # Run TypeScript type checking
npm run lint               # Lint code
npm run format             # Format with Prettier
```

## Testing

### Unit Tests (Jest)

- **Location**: `src/**/*.spec.tsx` or `src/**/*.spec.ts`
- **Framework**: Jest + React Testing Library + jest-mock-extended
- **Config**: `jest.config.ts` (two projects: `unit` for jsdom, `unit-node` for Node.js)
- **Setup**: `tests/unit/setup.ts` (adds jest-dom, polyfills, matchMedia mock)
- **Environment**: `NODE_ENV=test DEPLOYMENT_ENV=staging`

#### Unit Test Patterns

**MUST follow these patterns** (enforced by `.cursor/rules/`):

1. **Use `setup()` function instead of `beforeEach`**:
```typescript
describe("UserProfile", () => {
  it("renders user name when provided", () => {
    setup({ name: "John Doe" });
    expect(screen.queryByText("John Doe")).toBeInTheDocument();
  });

  // setup() goes at the BOTTOM of describe block
  function setup(input: { name?: string; email?: string }) {
    render(<UserProfile {...input} />);
    return input;
  }
});
```

2. **Use `queryBy*` instead of `getBy*` in assertions**:
```typescript
// Good
expect(screen.queryByText("John Doe")).toBeInTheDocument();
expect(screen.queryByText("Not Found")).not.toBeInTheDocument();

// Bad - avoid getBy in assertions
expect(screen.getByText("John Doe")).toBeInTheDocument();
```

3. **Use `jest-mock-extended` for mocking, never `jest.mock()`**:
```typescript
import { mock } from "jest-mock-extended";

describe("UserService", () => {
  it("creates user", async () => {
    const userRepository = mock<UserRepository>();
    const userService = new UserService(userRepository);

    userRepository.create.mockResolvedValue({ id: 1 });

    await expect(userService.create()).resolves.toEqual({ id: 1 });
  });
});
```

4. **Never use `any` type** - Always define proper TypeScript types

### E2E Tests (Playwright)

- **Location**: `tests/ui/*.spec.ts`
- **Framework**: Playwright with custom fixtures
- **Config**: `playwright.config.ts`
- **Timeout**: 60 seconds per test, 60 minutes global (CI only)
- **Browser**: Chromium only
- **Test Environment**: Loads `env/.env.test` via playwright.config.ts

#### E2E Test Architecture

**Fixtures** (`tests/ui/fixture/`):
- `context-with-extension.ts`: Creates browser context with Leap wallet extension loaded
  - Automatically imports test wallet from mnemonic
  - Auto-connects wallet and selects network (sandbox by default)
  - Sets up persistent browser context with extension
- `wallet-setup.ts`: Handles wallet import, connection, and balance top-up via faucet
- `test-env.config.ts`: Environment configuration with Zod validation
- `base-test.ts`: Base Playwright test fixture

**Page Object Models** (`tests/ui/pages/`):
- `DeployBasePage.tsx`: Base class with common deployment actions
  - `goto()`, `gotoInteractive()`: Navigation
  - `createDeployment()`: Click deploy + continue past deposit modal
  - `createLease(providerName?)`: Select provider and create lease
  - `signTransaction(feeType)`: Handle wallet popup signature
  - `validateLease()`: Assert lease is active and has URI
  - `closeDeploymentDetail()`: Close deployment via dropdown
- `DeployHelloWorldPage.tsx`: Extends DeployBasePage for hello-world template
- `BuildTemplatePage.tsx`, `PlainLinuxPage.tsx`, etc.: Specific template pages

**Actions** (`tests/ui/actions/`):
- `selectChainNetwork.ts`: Switch networks in app settings

**UI State Helpers** (`tests/ui/uiState/`):
- `isWalletConnected.ts`: Check if wallet is connected

#### E2E Test Environment Setup

Required environment variables in `env/.env.test`:
```bash
BASE_URL=http://localhost:3000
TEST_WALLET_MNEMONIC="twelve word mnemonic phrase here..."
NETWORK_ID=sandbox  # or mainnet, testnet-02, testnet-7
UI_CONFIG_SIGNATURE_PRIVATE_KEY=optional_for_signed_config
```

#### Writing E2E Tests

Example test structure:
```typescript
import { test } from "./fixture/context-with-extension";
import { DeployHelloWorldPage } from "./pages/DeployHelloWorldPage";

test("deploy hello world", async ({ context, page }) => {
  test.setTimeout(5 * 60 * 1000);  // 5 minutes for full deployment flow

  const helloWorldPage = new DeployHelloWorldPage(
    context,
    page,
    "new-deployment",      // path
    "hello-world-card"     // card test id
  );

  await helloWorldPage.gotoInteractive();
  await helloWorldPage.createDeploymentAndSign();
  await helloWorldPage.createLeaseAndSign();
  await helloWorldPage.validateLeaseAndClose();
});
```

#### E2E Test Fixtures

The Leap wallet extension is pre-packaged in `tests/ui/fixture/Leap/` directory. This is a full Chrome extension that gets loaded into the browser context for testing wallet interactions.

**Wallet Setup Flow**:
1. Browser launches with Leap extension loaded
2. Extension service worker extracts extension ID
3. Test navigates to extension page and imports wallet via mnemonic
4. Sets password to "12345678"
5. Restores extension storage from `leapExtensionLocalStorage.json`
6. Checks wallet balance and tops up via faucet if < 100 AKT
7. Connects wallet to app and selects network

**Provider Whitelists** (`test-env.config.ts`):
- Mainnet: `provider.hurricane.akash.pub`, `provider.europlots.com`
- Sandbox: `provider.europlots-sandbox.com`
- Used to select reliable providers for test lease creation

#### Running E2E Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run specific test file
npx playwright test tests/ui/deploy-hello-world.spec.ts

# Run with UI mode (recommended for development)
npx playwright test --ui

# Run in debug mode
npx playwright test --debug

# Run in headed mode (see browser)
npx playwright test --headed

# View last test report
npx playwright show-report
```

**Important**: E2E tests require:
1. Local dev server running (`npm run dev` or `npm run dc:up:dev -- deploy-web`)
2. Valid test wallet mnemonic in `env/.env.test`
3. Network connectivity to Akash RPC/API and faucet

## Feature Flags

Uses **Unleash** for feature flagging.

**Local Development**: Bypass remote flags by setting in `.env.local`:
```bash
NEXT_PUBLIC_UNLEASH_ENABLE_ALL=true
```

**Usage**: Always use the patched `useFlag` hook from this codebase (not directly from `@unleash/nextjs`).

## Authentication

**OAuth2 Flow**: Uses Auth0 in production, mock-oauth2-server locally.

- Sample env files (`.env.local.sample`) are pre-configured for mock server
- See root `doc/auth.md` for local auth setup and getting test tokens
- Auth context: `src/context/` (user session, managed wallets)

## Key Features & Concepts

### Wallet Integration
- **Cosmos Wallets**: Keplr, Leap, Cosmostation (via cosmos-kit)
- **Auth0 Users**: Can create managed wallets for deployments without browser extension
- **Wallet Context**: `src/context/WalletProvider/` handles wallet state

### SDL Templates
- **SDL**: Stack Definition Language (YAML) for Akash deployments
- **Monaco Editor**: `@monaco-editor/react` for SDL editing with syntax highlighting
- **Templates**: Pre-built templates for common apps (Hello World, Linux, databases, etc.)
- **Template Repository**: Fetched from GitHub, cached in API

### Deployment Flow
1. User selects template or creates custom SDL
2. Creates deployment (broadcasts `MsgCreateDeployment` tx)
3. Waits for bids from providers
4. Selects provider and creates lease (`MsgCreateLease` tx)
5. Provider deploys container and provides URI
6. User can manage (update, close) deployment

### Billing
- **Stripe Integration**: Credit card payments for managed wallets
- **Trial Mode**: Free trial for new users
- **Payment Polling**: Background polling to check payment status

### State Management
- **React Query**: Server state (API calls, blockchain queries)
- **Jotai**: Client state (UI state, settings)
- **Context**: User session, wallet, feature flags, theme

## Environment Variables

Key environment variables (see `env/.env.sample`):
- `NEXT_PUBLIC_API_BASE_URL`: API endpoint
- `NEXT_PUBLIC_PROVIDER_PROXY_URL`: Provider proxy endpoint
- `NEXT_PUBLIC_BILLING_ENABLED`: Enable Stripe billing
- `NEXT_PUBLIC_UNLEASH_*`: Feature flag settings
- `AUTH0_*`: Auth0 configuration
- `STRIPE_*`: Stripe configuration

## API Integration

Uses **@openapi-qraft/react** for type-safe API client generated from OpenAPI spec.

**API Client**: `src/queries/` contains React Query hooks wrapping the OpenAPI client.

Example:
```typescript
import { useApiQuery } from "@akashnetwork/react-query-sdk";

const { data, isLoading } = useApiQuery("/v1/deployments", {
  params: { address: userAddress }
});
```

## Common Development Tasks

### Adding a New Page
1. Create page in `src/pages/`
2. Add navigation link in sidebar component
3. Update routing if needed

### Adding a New Component
1. Create in appropriate `src/components/` subdirectory
2. Follow Material-UI patterns
3. Write unit tests with `setup()` pattern
4. Use `queryBy*` for test assertions

### Adding E2E Test
1. Create `.spec.ts` in `tests/ui/`
2. Import `test` from `fixture/context-with-extension`
3. Create or reuse Page Object Model in `tests/ui/pages/`
4. Use page methods for interactions
5. Handle wallet popups with `signTransaction()` or `approveWalletOperation()`

### Updating API Integration
1. API changes should auto-generate new types from OpenAPI spec
2. Update queries in `src/queries/` if needed
3. Test with unit tests (mock API responses with `jest-mock-extended`)

## TypeScript Configuration

- **Main**: `tsconfig.json` (strict mode, Next.js settings)
- **Tests**: `tsconfig.spec.json` (includes test files)
- **Path Aliases**:
  - `@src/*` → `src/*`
  - `@tests/*` → `tests/*`

## Code Standards

1. **Never use `any` type** - Always define proper types
2. **Never use deprecated methods** from libraries
3. **Don't add unnecessary comments** to code
4. **Test patterns**: Use `setup()`, `queryBy*`, `jest-mock-extended` (see Unit Test Patterns above)
5. **File references**: Use `file_path:line_number` format when referencing code

## Debugging

### Unit Tests
```bash
# Run specific test file
npm run test:unit -- src/queries/useTemplateQuery.spec.tsx

# Watch mode
npm run test:unit -- --watch

# Debug in VS Code
# Add breakpoint, use "Jest: Debug" launch config
```

### E2E Tests
```bash
# Debug mode (pauses on each action)
npx playwright test --debug

# Headed mode (see browser)
npx playwright test --headed

# Trace viewer (after test with --trace on)
npx playwright show-trace trace.zip
```

### Next.js
- Check `.next/` build output for errors
- Use React DevTools for component debugging
- Check browser console for client-side errors
- Check terminal for server-side errors

## Performance

- **Bundle Analysis**: `npm run build` with `ANALYZE=true` env var
- **React Query**: Aggressive caching for blockchain data
- **Code Splitting**: Dynamic imports for large components
- **Image Optimization**: Next.js Image component

## Deployment

- **Production Build**: `npm run build` (requires env schema compilation first)
- **Docker**: Uses multi-stage builds (see root `packages/docker/`)
- **Environment**: Set `DEPLOYMENT_ENV` to `production` or `staging`
