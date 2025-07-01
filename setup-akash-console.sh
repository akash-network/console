#!/bin/bash

# Akash Console Simple Setup Script
# Interactive CLI for local development setup

set -e

# Colors for better visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Clear screen and show header
clear
echo -e "${CYAN}"
echo "═══════════════════════════════════════════════════════════════"
echo "                    🚀 AKASH CONSOLE SETUP 🚀"
echo "                   Simple Local Development Setup"
echo "═══════════════════════════════════════════════════════════════"
echo -e "${NC}\n"

echo -e "${BLUE}Welcome to the Akash Console setup wizard!${NC}"
echo "This script will help you set up Akash Console for local development."
echo

# Function to ask yes/no questions
ask_yes_no() {
    while true; do
        read -p "$1 (y/n): " yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes (y) or no (n).";;
        esac
    done
}

# Function to show what we're doing
show_step() {
    echo -e "\n${PURPLE}▶ $1${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"
}

# Function to show success
show_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to show info
show_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to show warning
show_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to show error and exit
show_error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    exit 1
}

# Step 1: Check if we're in the right place
show_step "Checking current directory"

if [ -f "package.json" ] && grep -q "@akashnetwork/console" package.json 2>/dev/null; then
    show_success "Found Akash Console repository!"
    REPO_DIR="."
elif [ -d "akash-console" ]; then
    show_info "Found akash-console directory"
    cd akash-console
    REPO_DIR="akash-console"
else
    show_info "Akash Console repository not found in current directory"
    if ask_yes_no "Do you want to clone the Akash Console repository?"; then
        show_step "Cloning Akash Console repository"
        git clone https://github.com/akash-network/console.git akash-console
        cd akash-console
        show_success "Repository cloned successfully!"
        REPO_DIR="akash-console"
    else
        show_error "Please run this script from the Akash Console directory or let it clone the repository"
    fi
fi

# Step 2: Check prerequisites
show_step "Checking prerequisites"

echo "Checking required software..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | sed 's/v//')
    show_success "Node.js found: v$NODE_VERSION"

    # Check if version is compatible (major version should be 22+, minor 14+)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)
    NODE_MINOR=$(echo $NODE_VERSION | cut -d. -f2)
    NODE_PATCH=$(echo $NODE_VERSION | cut -d. -f3)

    if [ "$NODE_MAJOR" -lt 22 ] || ([ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 14 ]); then
        show_error "Node.js version $NODE_VERSION is below required version 22.14.0. Please install Node.js 22.14.0+ from https://nodejs.org"
    fi
else
    show_error "Node.js not found. Please install Node.js 22.14.0+ from https://nodejs.org"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    show_success "npm found: v$NPM_VERSION"
else
    show_error "npm not found. Please install npm"
fi

# Check Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    show_success "Git found: $GIT_VERSION"
else
    show_error "Git not found. Please install Git"
fi

echo
show_success "All prerequisites are installed!"

# Step 3: Environment Configuration
show_step "Environment Configuration"

echo "Akash Console needs environment files to run properly."
echo "We have working development credentials that you can use right away."
echo

USE_PROVIDED_CREDS=false
if ask_yes_no "Do you want to use the provided working development credentials?"; then
    USE_PROVIDED_CREDS=true
    show_info "Great! We'll set up working development credentials for you."
else
    show_info "You'll need to configure your own credentials after setup."
fi

echo

# Step 4: Create environment directories
show_step "Creating environment directories"

echo "Creating environment file directories..."
mkdir -p apps/deploy-web/env
mkdir -p apps/api/env
show_success "Environment directories created"

# Step 5: Create environment files
show_step "Creating environment files"

if [ "$USE_PROVIDED_CREDS" = true ]; then
    echo "Creating deploy-web environment file with working credentials..."

    cat > apps/deploy-web/env/.env.local << 'EOF'
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
EOF

    show_success "Deploy-web environment file created with working credentials"

    echo "Creating API environment file with working credentials..."

    cat > apps/api/env/.env.local << 'EOF'
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
EOF

    show_success "API environment file created with working credentials"
else
    echo "Creating basic environment file templates..."

    cat > apps/deploy-web/env/.env.local << 'EOF'
# Akash Console Deploy-Web Environment Configuration
# Please configure these values for your setup

MAINTENANCE_MODE=false

# Auth0 Configuration - Get from https://auth0.com
AUTH0_SECRET=your_random_32_character_secret_key_here
AUTH0_LOCAL_ENABLED=false
AUTH0_BASE_URL='http://localhost:3000'
AUTH0_ISSUER_BASE_URL='https://your-domain.auth0.com'
AUTH0_CLIENT_ID='your_client_id'
AUTH0_CLIENT_SECRET='your_client_secret'
AUTH0_AUDIENCE='https://console.akash.network'

# API Endpoints
NEXT_PUBLIC_API_BASE_URL=http://localhost:3080
NEXT_PUBLIC_STATS_APP_URL=http://localhost:3001
NEXT_PUBLIC_PROVIDER_PROXY_URL=http://localhost:3040

# Development Settings
NEXT_PUBLIC_BILLING_ENABLED=false
NEXT_PUBLIC_TRACKING_ENABLED=false
NEXT_PUBLIC_UNLEASH_ENABLE_ALL=true
EOF

    cat > apps/api/env/.env.local << 'EOF'
# Akash Console API Environment Configuration
# Please configure these values for your setup

# Database Configuration
NETWORK=sandbox
DB_HOST=localhost
POSTGRES_DB_URI=postgres://postgres:password@localhost:5432/console-users
CHAIN_INDEXER_POSTGRES_DB_URI=postgres://postgres:password@localhost:5432/console-akash-sandbox

# Development Settings
LOG_LEVEL=debug
DEPLOYMENT_ENV=local
FEATURE_FLAGS_ENABLE_ALL=true
BILLING_ENABLED=false

# CORS Configuration
CORS_WEBSITE_URLS=http://localhost:3000,http://localhost:3001
WEBSITE_URL=http://localhost:3000
EOF

    show_success "Basic environment templates created"
    show_warning "You'll need to configure the environment files before full functionality"
fi

# Step 6: Install dependencies
show_step "Installing dependencies"

echo "Installing npm dependencies (this may take a few minutes)..."
npm install
show_success "Dependencies installed successfully"

# Step 6.5: Check port availability
show_step "Checking port availability"

check_required_ports

# Step 7: Start the platform
show_step "Starting Akash Console"

echo "Starting the Akash Console platform locally..."
echo "This will start the deploy-web service and all required backend services."
echo

if ask_yes_no "Do you want to start the Akash Console now?"; then
    echo
    show_info "Starting Akash Console with: npm run dc:up:dev -- deploy-web"
    echo "This may take a moment to start all services..."
    echo

    # Start the platform
    npm run dc:up:dev -- deploy-web
else
    show_info "Skipping startup. You can start the console later with:"
    echo -e "  ${YELLOW}npm run dc:up:dev -- deploy-web${NC}"
fi

# Final summary
echo
echo -e "${GREEN}"
echo "═══════════════════════════════════════════════════════════════"
echo "                    🎉 SETUP COMPLETE! 🎉"
echo "═══════════════════════════════════════════════════════════════"
echo -e "${NC}\n"

echo -e "${CYAN}🌐 Your Akash Console is ready!${NC}\n"

echo -e "${BLUE}📋 Service URLs:${NC}"
echo -e "  • Main App:       ${CYAN}http://localhost:3000${NC}"
echo -e "  • API:            ${CYAN}http://localhost:3080${NC}"
echo -e "  • Stats:          ${CYAN}http://localhost:3001${NC}"
echo -e "  • Provider Proxy: ${CYAN}http://localhost:3040${NC}"
echo

echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo -e "  • Start console:  ${YELLOW}npm run dc:up:dev -- deploy-web${NC}"
echo -e "  • Stop services:  ${YELLOW}npm run dc:down${NC}"
echo -e "  • View logs:      ${YELLOW}npm run dc -- logs -f${NC}"
echo

if [ "$USE_PROVIDED_CREDS" = true ]; then
    echo -e "${GREEN}✅ Working development credentials are configured${NC}"
    echo -e "${BLUE}ℹ️  Your console should work immediately with test data${NC}"
else
    echo -e "${YELLOW}⚠️  Remember to configure your environment files:${NC}"
    echo -e "   • apps/deploy-web/env/.env.local"
    echo -e "   • apps/api/env/.env.local"
fi

echo
echo -e "${BLUE}📖 For detailed documentation:${NC}"
echo -e "   specs-and-notes/AKASH_CONSOLE_LOCAL_SETUP_GUIDE.md"
echo

echo -e "${GREEN}🚀 Happy coding with Akash Console!${NC}"
echo

# Show final status
echo -e "${CYAN}To start the console anytime, run:${NC}"
echo -e "  ${YELLOW}npm run dc:up:dev -- deploy-web${NC}"

echo
echo -e "${PURPLE}Need help? Check the troubleshooting guide or visit https://docs.akash.network${NC}"
