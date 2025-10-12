# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Akash Console is a monorepo for deploying Docker containers on the Akash Network. It consists of multiple TypeScript/Node.js applications deployed via Docker, sharing common packages and infrastructure.

**Architecture**: All services communicate with two PostgreSQL databases (Akash indexer database and User database). The Console app fetches data from both the API service and directly from Akash nodes via REST.

## Key Commands

### Development
```bash
# Quick start - runs deploy-web with all dependencies in dev mode
npm run dc:up:dev -- deploy-web

# Run specific apps with turbo (still requires Docker for PostgreSQL)
npm run console:dev      # Console UI + API + Provider Proxy
npm run stats:dev        # Stats UI + API
npm run api:dev          # API only
npm run indexer:dev      # Indexer only

# Run without Docker (must have PostgreSQL running elsewhere)
npm run console:dev:no-db
npm run stats:dev:no-db
```

### Docker Compose
```bash
npm run dc:build        # Build production images
npm run dc:up:prod      # Run in production mode
npm run dc:up:dev       # Run in development mode with hot-reload
npm run dc:down         # Stop all services
npm run dc:up:db        # Run PostgreSQL only
```

### Testing
```bash
# Deploy-web (Next.js)
npm run test:unit -w apps/deploy-web
npm run test:cov -w apps/deploy-web
npm run test:e2e -w apps/deploy-web     # Playwright tests

# API
npm run test:unit -w apps/api
npm run test:functional -w apps/api
npm run test -w apps/api                # Both unit + functional
```

### Build & Lint
```bash
npm run lint            # Lint all workspaces
npm run lint:fix        # Auto-fix linting issues
npm run format          # Format with Prettier
```

## Applications

### Console (`apps/deploy-web/`)
- **Tech**: Next.js 14 (App Router), Material-UI, React Query, TypeScript
- **Purpose**: Main UI for deploying on Akash Network
- **Dev**: `npm run console:dev` or `npm run dc:up:dev -- deploy-web`
- **Port**: 3000
- **Key features**:
  - OAuth2 authentication via Auth0 (or mock-oauth2-server locally)
  - Cosmos wallet integration (Keplr, Leap, etc.)
  - Feature flags via Unleash (bypass locally with `NEXT_PUBLIC_UNLEASH_ENABLE_ALL=true`)
  - SDL template editor with Monaco
  - Stripe billing integration

### API (`apps/api/`)
- **Tech**: Hono (web framework), Drizzle ORM, PostgreSQL, TypeScript
- **Purpose**: REST API serving Console and Stats apps
- **Dev**: `npm run api:dev`
- **Port**: 3080
- **Build**: Uses Webpack with multi-stage builds
- **Key features**:
  - OpenAPI/Swagger documentation at `/v1/swagger`
  - Managed wallet API for programmatic deployments
  - Cosmos SDK transaction handling
  - Stripe webhook handlers

### Stats (`apps/stats-web/`)
- **Tech**: Next.js, Nivo charts, TypeScript
- **Purpose**: Display Akash Network usage statistics
- **Dev**: `npm run stats:dev`
- **Port**: 3001

### Indexer (`apps/indexer/`)
- **Tech**: Node.js, LevelDB (block cache), PostgreSQL, TypeScript
- **Purpose**: Syncs blockchain data from RPC nodes to PostgreSQL database
- **Dev**: `npm run indexer:dev`
- **Port**: 3079 (health check endpoint)
- **Key responsibilities**:
  - Downloads blocks from RPC nodes and caches to disk
  - Processes messages through specialized indexers (validators, deployments, bids, leases)
  - Runs scheduled tasks (price sync, provider info, keybase data)
  - See `apps/indexer/README.md` for indexer architecture details

### Provider Proxy (`apps/provider-proxy/`)
- **Tech**: Node.js HTTP proxy
- **Purpose**: Proxy requests to Akash providers with certificate authentication
- **Why**: Browser can't use cert-based auth directly
- **Port**: 3040

### Other Apps
- **Provider Console** (`apps/provider-console/`): UI for Akash providers
- **Notifications** (`apps/notifications/`): Notification service
- **Log Collector** (`apps/log-collector/`): Deployment log aggregation

## Shared Packages (`packages/`)

- `@akashnetwork/ui` - Shared React components
- `@akashnetwork/database` - Database schemas and migrations
- `@akashnetwork/http-sdk` - OpenAPI client SDK for API
- `@akashnetwork/net` - Network utilities and chain definitions
- `@akashnetwork/jwt` - JWT utilities
- `@akashnetwork/logging` - Logging utilities
- `@akashnetwork/network-store` - Chain/network configuration
- `@akashnetwork/react-query-sdk` - React Query hooks
- `@akashnetwork/env-loader` - Environment variable loading
- `@akashnetwork/dev-config` - Shared ESLint/TypeScript configs
- `@akashnetwork/docker` - Docker Compose configurations

## Environment Setup

### Database
For local development, import a database backup:
- **Sandbox** (< 300 MB): `https://storage.googleapis.com/console-postgresql-backups/console-akash-sandbox.sql.gz` (recommended for dev)
- **Mainnet** (~30 GB): `https://storage.googleapis.com/console-postgresql-backups/console-akash-mainnet.sql.gz`

Running `npm run dc:up:dev` automatically imports the sandbox backup.

### Authentication
Uses OAuth2 for login. Local development uses [mock-oauth2-server](https://github.com/navikt/mock-oauth2-server).
- Sample `.env.local` files in `deploy-web` and `api` are pre-configured for the mock server
- See `doc/auth.md` for obtaining test tokens

## Code Standards

### TypeScript
- **Never use `any`** - Always define proper types
- Never use deprecated library methods
- Don't add unnecessary comments

### Testing
- **Use `jest-mock-extended`** for mocks, never `jest.mock()`
  - Pass mocks as dependencies to services under test
  - Avoids shared state between tests
- **Use `setup()` function** instead of `beforeEach` in test files
  - Place at bottom of describe block
  - Accepts inline-typed parameter object
  - Returns object under test
- **Use `queryBy*`** instead of `getBy*` in React test assertions
  - `queryBy` returns `null` if not found (safe for absence checks)
  - `getBy` throws if not found (harder to debug)

### File References
When referencing code locations, use the format: `file_path:line_number`
Example: "Clients are marked as failed in `src/services/process.ts:712`"

## Tech Stack

- **Node.js**: 22.14.0 (enforced via Volta)
- **Package Manager**: npm 11.2.0
- **Framework**: Next.js 14, Hono
- **Database**: PostgreSQL with Drizzle ORM
- **Monorepo**: Turborepo
- **Testing**: Jest (unit), Playwright (e2e), React Testing Library
- **Styling**: Material-UI, Emotion, Tailwind CSS
- **State**: React Query, Jotai
- **Blockchain**: CosmJS, AkashJS

## Architecture Notes

### Data Flow
1. **Indexer** syncs blockchain data from Akash RPC nodes → PostgreSQL
2. **API** serves data from PostgreSQL → REST endpoints
3. **Console/Stats** apps fetch from API + direct Akash node calls (for real-time data)
4. **Provider Proxy** handles cert-authenticated provider communication

### Monorepo Structure
- Uses npm workspaces for dependency management
- Turborepo for build orchestration (see `turbo.json`)
- Shared packages referenced with `"*"` version in package.json
- Docker Compose configs in `packages/docker/`

### Database Structure
- **Akash Database**: Indexed blockchain data (blocks, transactions, deployments, providers, etc.)
- **User Database**: User accounts, managed wallets, billing (auto-created if empty)
- See `doc/database-structure.md` for schema details

### Release Process
- Uses `release-it` with conventional-changelog
- Automated via GitHub Actions
- See `doc/release-workflow.md` for details
