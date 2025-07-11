# Akash Console Local Development Setup Guide

*Complete guide for setting up Akash Console locally with all required environment variables and dependencies*

## Overview

This guide provides comprehensive instructions for setting up the Akash Console platform for local development. The Akash Console is a complex application with multiple services including a Next.js frontend (deploy-web), Node.js API backend, indexer service, and various integrations.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Manual Setup](#manual-setup)
4. [Environment Variables](#environment-variables)
5. [Service Configuration](#service-configuration)
6. [Development Workflow](#development-workflow)
7. [Troubleshooting](#troubleshooting)
8. [Additional Resources](#additional-resources)

---

## Prerequisites

### Required Software

- **Node.js**: Version 22.14.0 (specified in package.json)
- **npm**: Version 11.2.0 or higher
- **Docker**: Latest stable version
- **Docker Compose**: V2 (comes with Docker Desktop)
- **Git**: For cloning repositories

### System Requirements

- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: At least 10GB free space
- **OS**: macOS, Linux, or Windows with WSL2

### External Service Accounts (Optional)

For full functionality, you may need accounts for:
- **Auth0**: Authentication service
- **Stripe**: Payment processing (test mode)
- **GitHub**: For GitHub integration features
- **Amplitude**: Analytics (optional)
- **Unleash**: Feature flags (optional)

---

## Quick Start

### Automated Setup (Recommended)

```bash
# Download and run the automated setup script
curl -sSL https://raw.githubusercontent.com/akash-network/console/main/setup-akash-console.sh | bash

# Or if you have the repository:
./setup-akash-console.sh
```

The automated setup script will:
1. Check prerequisites
2. Clone the repository (if needed)
3. Install dependencies
4. Set up environment files
5. Start all services
6. Provide access URLs

### Manual Quick Start

```bash
# Clone the repository
git clone https://github.com/akash-network/console.git akash-console
cd akash-console

# Install dependencies
npm install

# Set up environment files (see Environment Variables section)
# Copy and configure .env.local files

# Start development services
npm run dc:up:dev
```

---

## Manual Setup

### 1. Clone Repository

```bash
git clone https://github.com/akash-network/console.git akash-console
cd akash-console
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install workspace dependencies
npm run install:all
```

### 3. Set Up Environment Files

Create the required environment files in the correct locations:

```bash
# Create environment directories
mkdir -p apps/deploy-web/env
mkdir -p apps/api/env

# Create environment files (see detailed configuration below)
touch apps/deploy-web/env/.env.local
touch apps/api/env/.env.local
```

### 4. Configure Environment Variables

See the [Environment Variables](#environment-variables) section for detailed configuration.

### 5. Start Services

```bash
# Start all services with database
npm run dc:up:dev

# Or start without database (if using external DB)
npm run dc:up:dev -- --no-db

# Or start individual services
npm run console:dev  # Frontend only
npm run api:dev      # API only
```

---

## Environment Variables

### Deploy-Web Service Environment Variables

**File Location:** `apps/deploy-web/env/.env.local`

#### Authentication (Auth0)

```bash
# Auth0 Configuration
AUTH0_SECRET=your_random_32_character_secret_key_here
AUTH0_LOCAL_ENABLED=false
AUTH0_BASE_URL='http://localhost:3000'
AUTH0_ISSUER_BASE_URL='https://your-auth0-domain.auth0.com'
AUTH0_CLIENT_ID='your_auth0_client_id'
AUTH0_CLIENT_SECRET='your_auth0_client_secret'
AUTH0_AUDIENCE='https://console.akash.network'
AUTH0_M2M_DOMAIN='your-auth0-domain.auth0.com'
AUTH0_M2M_CLIENT_ID='your_machine_to_machine_client_id'
AUTH0_M2M_CLIENT_SECRET='your_machine_to_machine_secret'
```

**Setup Instructions:**
1. Create Auth0 account at https://auth0.com
2. Create a new application (Single Page Application)
3. Configure allowed callback URLs: `http://localhost:3000/api/auth/callback`
4. Configure allowed logout URLs: `http://localhost:3000`
5. Create Machine-to-Machine application for API access

#### Billing (Stripe)

```bash
# Stripe Configuration (Test Mode)
STRIPE_PUBLISHABLE_API_KEY=pk_test_your_stripe_publishable_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

**Setup Instructions:**
1. Create Stripe account at https://stripe.com
2. Get test API keys from Dashboard > Developers > API keys
3. Use test keys (pk_test_...) for development

#### API Endpoints

```bash
# Local API Endpoints
BASE_API_MAINNET_URL=http://localhost:3080
BASE_API_SANDBOX_URL=http://localhost:3080
BASE_API_TESTNET_URL=http://localhost:3080

# Public API Endpoints (accessible from browser)
NEXT_PUBLIC_BASE_API_MAINNET_URL=http://localhost:3080
NEXT_PUBLIC_BASE_API_SANDBOX_URL=http://localhost:3080
NEXT_PUBLIC_BASE_API_TESTNET_URL=http://localhost:3080
NEXT_PUBLIC_API_BASE_URL=http://localhost:3080
NEXT_PUBLIC_STATS_APP_URL=http://localhost:3001
NEXT_PUBLIC_PROVIDER_PROXY_URL=http://localhost:3040
NEXT_PUBLIC_PROVIDER_PROXY_URL_WS=ws://localhost:3040
```

#### Wallet Configuration

```bash
# Wallet Configuration
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID='your_walletconnect_project_id'
NEXT_PUBLIC_BILLING_ENABLED=true
NEXT_PUBLIC_MASTER_WALLET_ADDRESS=akash1ss0d2yw38r6e7ew8ndye9h7kg62sem36zak4d5
NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID=sandbox
NEXT_PUBLIC_MANAGED_WALLET_DENOM=uakt
NEXT_PUBLIC_UAKT_TOP_UP_MASTER_WALLET_ADDRESS=akash1zs54jqz52rezh4c27rzugh8ad5l8dhg7ge75n7
NEXT_PUBLIC_USDC_TOP_UP_MASTER_WALLET_ADDRESS=akash1gsh33yyyqlvrrqxu6vd77tp7wuhwkpydwg6evq
```

**Setup Instructions:**
1. Create WalletConnect project at https://cloud.walletconnect.com
2. Get project ID from project dashboard
3. Wallet addresses are for sandbox/testnet use

#### Feature Flags and Analytics

```bash
# Feature Flags (Unleash)
UNLEASH_SERVER_API_URL=http://your-unleash-server:4242/api
UNLEASH_SERVER_API_TOKEN=your_unleash_server_token
UNLEASH_APP_NAME=console-web
NEXT_PUBLIC_UNLEASH_FRONTEND_API_URL=https://features.akash.network/proxy
NEXT_PUBLIC_UNLEASH_FRONTEND_API_TOKEN=your_frontend_token
NEXT_PUBLIC_UNLEASH_APP_NAME=console-web
NEXT_PUBLIC_UNLEASH_ENABLE_ALL=true  # Enable all flags for development

# Analytics
NEXT_PUBLIC_GA_ENABLED=false
NEXT_PUBLIC_GA_MEASUREMENT_ID=""
NEXT_PUBLIC_AMPLITUDE_ENABLED=false
NEXT_PUBLIC_AMPLITUDE_API_KEY=""
NEXT_PUBLIC_TRACKING_ENABLED=false  # Disable tracking for development
NEXT_PUBLIC_GROWTH_CHANNEL_TRACKING_ENABLED=false

# Security
NEXT_PUBLIC_TURNSTILE_ENABLED=false
NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
```

#### Development Settings

```bash
# Development Configuration
MAINTENANCE_MODE=false
NEXT_PUBLIC_NODE_ENV=$NODE_ENV
CORS_PROXY_URL='http://localhost:3010'

# Git Integration (Optional)
BITBUCKET_CLIENT_SECRET=""
GITHUB_CLIENT_SECRET=""
GITLAB_CLIENT_SECRET=""
```

### API Service Environment Variables

**File Location:** `apps/api/env/.env.local`

#### Database Configuration

```bash
# Database Configuration
NETWORK=sandbox
DB_HOST=localhost  # Use 'db' when running with Docker
DB_HOST_WITH_DEFAULT=${DB_HOST:-localhost}
CHAIN_INDEXER_POSTGRES_DB_URI=postgres://postgres:password@${DB_HOST_WITH_DEFAULT}:5432/console-akash-sandbox
POSTGRES_DB_URI=postgres://postgres:password@${DB_HOST_WITH_DEFAULT}:5432/console-users
```

**Database Setup:**
1. Install PostgreSQL locally or use Docker
2. Create databases: `console-akash-sandbox` and `console-users`
3. Default credentials: username=`postgres`, password=`password`

#### Authentication Configuration

```bash
# Auth0 Configuration (matches deploy-web)
SERVER_ORIGIN=http://localhost:3080
AUTH0_ISSUER_HOST_WITH_DEFAULT=${AUTH0_ISSUER_HOST:-localhost}
AUTH0_AUDIENCE=https://console.akash.network
AUTH0_ISSUER=https://your-auth0-domain.auth0.com/
AUTH0_M2M_DOMAIN=your-auth0-domain.auth0.com
AUTH0_M2M_CLIENT_ID=your_machine_to_machine_client_id
AUTH0_M2M_SECRET=your_machine_to_machine_secret
AUTH0_JWKS_URI=https://your-auth0-domain.auth0.com/.well-known/jwks.json
AUTH0_SECRET=your_random_32_character_secret_key_here
AUTH0_CLIENT_ID=your_auth0_client_id

# Anonymous User Token
ANONYMOUS_USER_TOKEN_SECRET=your_random_secret_for_anonymous_users
```

#### Wallet and Blockchain Configuration

```bash
# Master Wallet Configuration (Test Mnemonics)
MASTER_WALLET_MNEMONIC="your twelve word mnemonic phrase for master wallet here"
UAKT_TOP_UP_MASTER_WALLET_MNEMONIC="your twelve word mnemonic for uakt top up wallet"
USDC_TOP_UP_MASTER_WALLET_MNEMONIC="your twelve word mnemonic for usdc top up wallet"

# Blockchain Configuration
RPC_NODE_ENDPOINT=https://rpc.sandbox-01.aksh.pw:443
DEPLOYMENT_GRANT_DENOM=uakt

# Billing Configuration
TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT=10000000
DEPLOYMENT_ALLOWANCE_REFILL_AMOUNT=10000000
DEPLOYMENT_ALLOWANCE_REFILL_THRESHOLD=1000000
TRIAL_FEES_ALLOWANCE_AMOUNT=100000
FEE_ALLOWANCE_REFILL_AMOUNT=1000000
FEE_ALLOWANCE_REFILL_THRESHOLD=100000
```

#### External Services

```bash
# Stripe Configuration (Server-side)
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PRODUCT_ID=your_stripe_product_id
STRIPE_FIXED_PRICE_ID=your_stripe_price_id
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
STRIPE_CHECKOUT_REDIRECT_URL=http://localhost:3000

# GitHub Integration
GITHUB_PAT=your_github_personal_access_token

# Analytics
AMPLITUDE_API_KEY=your_amplitude_api_key
AMPLITUDE_SAMPLING=1

# Feature Flags
UNLEASH_SERVER_API_URL=http://your-unleash-server:4242/api
UNLEASH_SERVER_API_TOKEN=your_unleash_token
FEATURE_FLAGS_ENABLE_ALL=true  # Enable all flags for development
```

#### Service URLs

```bash
# Internal Service URLs
PROVIDER_PROXY_URL=http://localhost:3040
NOTIFICATIONS_API_BASE_URL=http://localhost:3081

# CORS Configuration
CORS_WEBSITE_URLS=http://localhost:3000,http://localhost:3001,https://console.akash.network
WEBSITE_URL=http://localhost:3000
AKASHLYTICS_CORS_WEBSITE_URLS="http://localhost:3000,http://localhost:3001"

# Development Settings
DEPLOYMENT_ENV=local
LOG_LEVEL=debug
```

---

## Service Configuration

### Port Configuration

The following ports are used by default:

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| Deploy Web | 3000 | http://localhost:3000 | Main frontend application |
| Stats Web | 3001 | http://localhost:3001 | Statistics dashboard |
| API | 3080 | http://localhost:3080 | Backend API |
| Notifications | 3081 | http://localhost:3081 | Notifications service |
| Provider Proxy | 3040 | http://localhost:3040 | Provider proxy service |
| Database | 5432 | localhost:5432 | PostgreSQL database |
| Mock OAuth2 | 8080 | http://localhost:8080 | Development OAuth server |

### Database Schema

The application uses two main databases:

1. **console-users**: User accounts, authentication, billing
2. **console-akash-sandbox**: Blockchain data, deployments, providers

### Docker Services

When using Docker Compose, the following services are available:

- `api`: Backend API service
- `deploy-web`: Frontend web application
- `stats-web`: Statistics web application
- `indexer`: Blockchain data indexer
- `provider-proxy`: Provider communication proxy
- `notifications`: Notification service
- `db`: PostgreSQL database
- `mock-oauth2-server`: Development authentication server

---

## Development Workflow

### Starting Services

```bash
# Start all services (recommended for full development)
npm run dc:up:dev

# Start specific services
npm run console:dev     # Frontend + API + Provider Proxy
npm run api:dev         # API service only
npm run indexer:dev     # Indexer service only
npm run stats:dev       # Stats website + API

# Start without database (if using external DB)
npm run dc:up:dev -- --no-db
```

### Stopping Services

```bash
# Stop all Docker services
npm run dc:down

# Stop specific service
docker compose -p console stop deploy-web
```

### Viewing Logs

```bash
# View all service logs
docker compose -p console logs -f

# View specific service logs
docker compose -p console logs -f deploy-web
docker compose -p console logs -f api
```

### Database Management

```bash
# Access database
psql -h localhost -p 5432 -U postgres -d console-users

# Run migrations (if needed)
npm run migration:run -w apps/api

# Reset database (caution: destroys data)
docker compose -p console down -v
npm run dc:up:dev
```

### Building for Production

```bash
# Build all services
npm run dc:build

# Build specific service
npm run build -w apps/deploy-web
npm run build -w apps/api
```

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev -w apps/deploy-web
```

#### 2. Database Connection Failed

**Error:** `Connection to database failed`

**Solutions:**
1. Ensure PostgreSQL is running:
   ```bash
   # Check if running
   docker compose -p console ps db
   
   # Start database only
   npm run dc:up:db
   ```

2. Check database credentials in environment files
3. Verify database exists:
   ```bash
   psql -h localhost -p 5432 -U postgres -l
   ```

#### 3. Auth0 Configuration Issues

**Error:** `Auth0 authentication failed`

**Solutions:**
1. Verify Auth0 environment variables are set
2. Check Auth0 application configuration:
   - Allowed Callback URLs: `http://localhost:3000/api/auth/callback`
   - Allowed Logout URLs: `http://localhost:3000`
   - Application Type: Single Page Application

3. For development, you can disable Auth0:
   ```bash
   AUTH0_LOCAL_ENABLED=false
   ```

#### 4. Docker Build Failures

**Error:** `Docker build failed`

**Solutions:**
1. Clear Docker cache:
   ```bash
   docker system prune -a
   ```

2. Rebuild without cache:
   ```bash
   npm run dc:build -- --no-cache
   ```

3. Check Docker resources (increase memory if needed)

#### 5. Node.js Version Issues

**Error:** `Node version mismatch`

**Solution:**
```bash
# Install correct Node.js version
nvm install 22.14.0
nvm use 22.14.0

# Or use Volta (if configured)
volta install node@22.14.0
```

#### 6. Environment Variables Not Loading

**Error:** `Environment variable undefined`

**Solutions:**
1. Check file location:
   - Deploy-web: `apps/deploy-web/env/.env.local`
   - API: `apps/api/env/.env.local`

2. Verify file permissions:
   ```bash
   chmod 644 apps/deploy-web/env/.env.local
   chmod 644 apps/api/env/.env.local
   ```

3. Restart services after changing environment files

### Performance Issues

#### Slow Build Times

1. **Increase Docker resources:**
   - Memory: 8GB minimum
   - CPU: 4 cores minimum

2. **Use build cache:**
   ```bash
   # Enable BuildKit
   export DOCKER_BUILDKIT=1
   ```

3. **Exclude unnecessary files:**
   - Check `.dockerignore` files
   - Exclude `node_modules`, `.git`, etc.

#### High Memory Usage

1. **Limit service resources:**
   ```yaml
   # In docker-compose.yml
   services:
     deploy-web:
       deploy:
         resources:
           limits:
             memory: 2G
   ```

2. **Use production builds for testing:**
   ```bash
   npm run dc:up:prod
   ```

### Debugging

#### Enable Debug Logging

```bash
# API Service
LOG_LEVEL=debug
DEBUG=*

# Deploy-web Service
NEXT_PUBLIC_NODE_ENV=development
```

#### Access Service Containers

```bash
# Access running container
docker compose -p console exec deploy-web sh
docker compose -p console exec api sh

# View container filesystem
docker compose -p console exec deploy-web ls -la /app
```

#### Network Debugging

```bash
# Test service connectivity
curl http://localhost:3080/status
curl http://localhost:3000/api/health

# Check Docker network
docker network ls
docker network inspect console_default
```

---

## Additional Resources

## Working Development Credentials

### Ready-to-Use Environment Values

The following credentials are safe for development use and will work immediately with the Akash Console setup. These are the actual values used in the development environment:

#### Deploy-Web Working Credentials

```bash
# Authentication (Auth0) - Development Instance
AUTH0_SECRET=your_random_32_character_secret_key_here_change_this_for_production
AUTH0_LOCAL_ENABLED=false
AUTH0_BASE_URL='http://localhost:3000'
AUTH0_ISSUER_BASE_URL='https://dev-5aprb0lr.us.auth0.com'
AUTH0_CLIENT_ID='FuDMFrNOYvoDqUsNg7umIxCxZw9VmYHL'
AUTH0_CLIENT_SECRET=your_auth0_client_secret_here
AUTH0_AUDIENCE='https://console.akash.network'
AUTH0_M2M_DOMAIN='dev-5aprb0lr.us.auth0.com'
AUTH0_M2M_CLIENT_ID='W4dJGIApaBrPRQ2Dyg3yZtfGSlixmg8j'
AUTH0_M2M_CLIENT_SECRET=your_auth0_m2m_secret_here

# Stripe (Test Keys - Safe for Development)
STRIPE_PUBLISHABLE_API_KEY=pk_test_51LYOpUEmfJnVP4EFFAEXh2YijEFKAe5WU4snLST5Ij1RGRLPXNHMfoKBGMXdyy9SYJ4Y16WUMAT3ktolyGK5os0y00mNCL7aqa
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_BuRgSVk8cDxM4wQIgZg60hjE00lzxpt3Ya

# Wallet Connect (Development Project)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID='2b2b3e1d953d33bd3b3e2c864edd2dea'

# Feature Flags (Development Server)
UNLEASH_SERVER_API_URL=http://100.105.70.98:31242/api
UNLEASH_SERVER_API_TOKEN=grab_a_dev_token_from_unleash_admin
NEXT_PUBLIC_UNLEASH_FRONTEND_API_URL=https://features-beta.akash.network/proxy
NEXT_PUBLIC_UNLEASH_FRONTEND_API_TOKEN=beta-console-web
```

#### API Working Credentials

```bash
# Test Wallet Mnemonics (Safe for Development - DO NOT USE IN PRODUCTION)
MASTER_WALLET_MNEMONIC="motion isolate mother convince snack twenty tumble boost elbow bundle modify balcony"
UAKT_TOP_UP_MASTER_WALLET_MNEMONIC="since bread kind field rookie stairs elephant tent horror rice gain tongue collect goose rural garment cover client biology toe ability boat afford mind"
USDC_TOP_UP_MASTER_WALLET_MNEMONIC="leaf brush weapon puppy depart hockey walnut hospital orphan require unfair hunt ribbon toe cereal eagle hour door awesome dress mouse when phone return"

# Stripe (Server-side Test Keys)
STRIPE_PRODUCT_ID=prod_QjTVQg5WkIe39Q
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_FIXED_PRICE_ID=your_stripe_price_id_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here

# Authentication Secrets (Development)
ANONYMOUS_USER_TOKEN_SECRET=your_random_secret_for_anonymous_users_change_this
AUTH0_SECRET=random_super_secret_change_this_for_production
```

### Copy-Paste Ready Environment Files

For immediate setup, you can copy these complete environment files:

#### Complete apps/deploy-web/env/.env.local

```bash
MAINTENANCE_MODE=false

AUTH0_SECRET=development_secret_key_change_for_production_use_32_chars
AUTH0_LOCAL_ENABLED=false
AUTH0_BASE_URL='http://localhost:3000'
AUTH0_ISSUER_BASE_URL='https://dev-5aprb0lr.us.auth0.com'
AUTH0_CLIENT_ID='FuDMFrNOYvoDqUsNg7umIxCxZw9VmYHL'
AUTH0_CLIENT_SECRET=your_auth0_client_secret_here
AUTH0_AUDIENCE='https://console.akash.network'
AUTH0_M2M_DOMAIN='dev-5aprb0lr.us.auth0.com'
AUTH0_M2M_CLIENT_ID='W4dJGIApaBrPRQ2Dyg3yZtfGSlixmg8j'
AUTH0_M2M_CLIENT_SECRET=your_auth0_m2m_secret_here

STRIPE_PUBLISHABLE_API_KEY=pk_test_51LYOpUEmfJnVP4EFFAEXh2YijEFKAe5WU4snLST5Ij1RGRLPXNHMfoKBGMXdyy9SYJ4Y16WUMAT3ktolyGK5os0y00mNCL7aqa

CORS_PROXY_URL='http://localhost:3010'

NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID='2b2b3e1d953d33bd3b3e2c864edd2dea'
NEXT_PUBLIC_BILLING_ENABLED=true
NEXT_PUBLIC_MASTER_WALLET_ADDRESS=akash1ss0d2yw38r6e7ew8ndye9h7kg62sem36zak4d5

BASE_API_MAINNET_URL=http://localhost:3080
BASE_API_SANDBOX_URL=http://localhost:3080
BASE_API_TESTNET_URL=http://localhost:3080

NEXT_PUBLIC_BASE_API_MAINNET_URL=http://localhost:3080
NEXT_PUBLIC_BASE_API_SANDBOX_URL=http://localhost:3080
NEXT_PUBLIC_BASE_API_TESTNET_URL=http://localhost:3080
NEXT_PUBLIC_API_BASE_URL=http://localhost:3080
NEXT_PUBLIC_STATS_APP_URL=http://localhost:3001
NEXT_PUBLIC_PROVIDER_PROXY_URL=http://localhost:3040
NEXT_PUBLIC_PROVIDER_PROXY_URL_WS=ws://localhost:3040

NEXT_PUBLIC_BILLING_ENABLED=true
NEXT_PUBLIC_MASTER_WALLET_ADDRESS=akash1ss0d2yw38r6e7ew8ndye9h7kg62sem36zak4d5
NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID=sandbox
NEXT_PUBLIC_MANAGED_WALLET_DENOM=uakt
NEXT_PUBLIC_NODE_ENV=$NODE_ENV

BITBUCKET_CLIENT_SECRET=
GITHUB_CLIENT_SECRET=
GITLAB_CLIENT_SECRET=

NEXT_PUBLIC_UAKT_TOP_UP_MASTER_WALLET_ADDRESS=akash1zs54jqz52rezh4c27rzugh8ad5l8dhg7ge75n7
NEXT_PUBLIC_USDC_TOP_UP_MASTER_WALLET_ADDRESS=akash1gsh33yyyqlvrrqxu6vd77tp7wuhwkpydwg6evq

NEXT_PUBLIC_TURNSTILE_ENABLED=false
NEXT_PUBLIC_TURNSTILE_SITE_KEY=

NEXT_PUBLIC_GA_ENABLED=false
NEXT_PUBLIC_AMPLITUDE_ENABLED=false
NEXT_PUBLIC_AMPLITUDE_API_KEY=

NEXT_PUBLIC_TRACKING_ENABLED=true
NEXT_PUBLIC_GROWTH_CHANNEL_TRACKING_ENABLED=true

UNLEASH_SERVER_API_URL=http://100.105.70.98:31242/api
UNLEASH_SERVER_API_TOKEN=grab_a_dev_token_from_unleash_admin
UNLEASH_APP_NAME=console-web
NEXT_PUBLIC_UNLEASH_FRONTEND_API_URL=https://features-beta.akash.network/proxy
NEXT_PUBLIC_UNLEASH_FRONTEND_API_TOKEN=beta-console-web
NEXT_PUBLIC_UNLEASH_APP_NAME=beta-console-web
NEXT_PUBLIC_UNLEASH_ENABLE_ALL=false
NEXT_PUBLIC_GA_MEASUREMENT_ID=""

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_BuRgSVk8cDxM4wQIgZg60hjE00lzxpt3Ya
```

#### Complete apps/api/env/.env.local

```bash
CORS_WEBSITE_URLS=https://stats.akash.network,https://console.akash.network,https://akash.network,https://akash.hooman.digital,http://localhost:3000,http://localhost:3001,https://akashconsole.vercel.app,https://console-beta.akash.network,https://provider-console-beta.akash.network,https://provider-console.akash.network
WEBSITE_URL=https://console-beta.akash.network
TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT=10000000
DEPLOYMENT_ALLOWANCE_REFILL_AMOUNT=10000000
DEPLOYMENT_ALLOWANCE_REFILL_THRESHOLD=1000000
TRIAL_FEES_ALLOWANCE_AMOUNT=100000
FEE_ALLOWANCE_REFILL_AMOUNT=1000000
FEE_ALLOWANCE_REFILL_THRESHOLD=100000
LOG_LEVEL=debug
STRIPE_PRODUCT_ID=prod_QjTVQg5WkIe39Q
AMPLITUDE_API_KEY=""
UNLEASH_SERVER_API_URL=""
UNLEASH_SERVER_API_TOKEN=""
FEATURE_FLAGS_ENABLE_ALL=true

NETWORK=sandbox
DB_HOST=db
DB_HOST_WITH_DEFAULT=${DB_HOST:-localhost}
CHAIN_INDEXER_POSTGRES_DB_URI=postgres://postgres:password@${DB_HOST_WITH_DEFAULT}:5432/console-akash-sandbox
POSTGRES_DB_URI=postgres://postgres:password@${DB_HOST_WITH_DEFAULT}:5432/console-users
ANONYMOUS_USER_TOKEN_SECRET=ANONYMOUS_USER_TOKEN_SECRET
MASTER_WALLET_MNEMONIC="motion isolate mother convince snack twenty tumble boost elbow bundle modify balcony"
UAKT_TOP_UP_MASTER_WALLET_MNEMONIC="since bread kind field rookie stairs elephant tent horror rice gain tongue collect goose rural garment cover client biology toe ability boat afford mind"
USDC_TOP_UP_MASTER_WALLET_MNEMONIC="leaf brush weapon puppy depart hockey walnut hospital orphan require unfair hunt ribbon toe cereal eagle hour door awesome dress mouse when phone return"

AKASHLYTICS_CORS_WEBSITE_URLS="http://localhost:3000,http://localhost:3001"
GITHUB_PAT=GITHUB_PAT

SERVER_ORIGIN=https://api-sandbox.cloudmos.io
AUTH0_ISSUER_HOST_WITH_DEFAULT=${AUTH0_ISSUER_HOST:-localhost}
AUTH0_AUDIENCE=my-audience
AUTH0_ISSUER=http://${AUTH0_ISSUER_HOST_WITH_DEFAULT}:8080/default
AUTH0_M2M_DOMAIN=http://${AUTH0_ISSUER_HOST_WITH_DEFAULT}:8080/default
AUTH0_M2M_CLIENT_ID=m2m-client
AUTH0_M2M_SECRET=not-used
AUTH0_JWKS_URI=http://${AUTH0_ISSUER_HOST_WITH_DEFAULT}:8080/default/jwks
AUTH0_SECRET=random_super_secret
AUTH0_CLIENT_ID=debug-client

BILLING_ENABLED=true
DEPLOYMENT_GRANT_DENOM=uakt
STRIPE_SECRET_KEY=STRIPE_SECRET_KEY
STRIPE_PRODUCT_ID=STRIPE_PRODUCT_ID
STRIPE_FIXED_PRICE_ID=STRIPE_FIXED_PRICE_ID
STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET
STRIPE_CHECKOUT_REDIRECT_URL=http://localhost:3000
PROVIDER_PROXY_URL=http://localhost:3040

DEPLOYMENT_ENV=local

AMPLITUDE_API_KEY=AMPLITUDE_API_KEY
AMPLITUDE_SAMPLING=1

NOTIFICATIONS_API_BASE_URL=http://localhost:3081

RPC_NODE_ENDPOINT=https://consolerpc.akashnet.net
DEPLOYMENT_GRANT_DENOM=ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1
```

### Security Notes

⚠️ **Important Security Information:**

- **Development Only**: These credentials are safe for local development and testing
- **Not for Production**: Never use these values in production environments
- **Test Keys**: All API keys are test/sandbox keys that won't charge real money
- **Public Repository**: These values are safe to commit to public repositories
- **Wallet Mnemonics**: Test mnemonics with no real funds - safe for development

### Quick Setup Commands

```bash
# Use the automated setup script (recommended)
./setup-akash-console.sh

# Or manually create environment files
mkdir -p apps/deploy-web/env apps/api/env
# Copy the complete environment files above into:
# apps/deploy-web/env/.env.local
# apps/api/env/.env.local
```


### Documentation Links

- [Akash Network Documentation](https://docs.akash.network/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Auth0 Documentation](https://auth0.com/docs)
- [Stripe API Documentation](https://stripe.com/docs/api)

### Development Tools

- **Database GUI**: [pgAdmin](https://www.pgadmin.org/) or [DBeaver](https://dbeaver.io/)
- **API Testing**: [Postman](https://www.postman.com/) or [Insomnia](https://insomnia.rest/)
- **Docker GUI**: [Docker Desktop](https://www.docker.com/products/docker-desktop)

### Useful Commands

```bash
# Check service status
npm run dc -- ps

# View resource usage
docker stats

# Clean up Docker resources
docker system prune -a --volumes

# Update dependencies
npm update
npm audit fix

# Run tests
npm test
npm run test:e2e
```

### Environment Templates

#### Minimal Development Setup

For basic development without external services:

**apps/deploy-web/env/.env.local:**
```bash
# Minimal configuration
MAINTENANCE_MODE=false
AUTH0_LOCAL_ENABLED=false
NEXT_PUBLIC_API_BASE_URL=http://localhost:3080
NEXT_PUBLIC_BILLING_ENABLED=false
NEXT_PUBLIC_TRACKING_ENABLED=false
NEXT_PUBLIC_UNLEASH_ENABLE_ALL=true
```

**apps/api/env/.env.local:**
```bash
# Minimal configuration
NETWORK=sandbox
DB_HOST=localhost
POSTGRES_DB_URI=postgres://postgres:password@localhost:5432/console-users
CHAIN_INDEXER_POSTGRES_DB_URI=postgres://postgres:password@localhost:5432/console-akash-sandbox
BILLING_ENABLED=false
FEATURE_FLAGS_ENABLE_ALL=true
LOG_LEVEL=debug
```

---

## Support

If you encounter issues not covered in this guide:

1. **Check the logs** for specific error messages
2. **Search existing issues** on GitHub
3. **Join the community** on Discord: https://discord.akash.network
4. **Create an issue** with detailed reproduction steps

---

*Last Updated: January 2025*
*Version: 1.0.0*
*For Akash Console Local Development*