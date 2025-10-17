# E2E Manual QA Checklist for Deploy-Web

## Overview

This checklist covers comprehensive end-to-end testing for the Akash Console Deploy-Web application. It's split into two parts:

1. **Automated E2E Coverage** - What's already covered by Playwright tests
2. **Manual Testing Required** - What needs manual verification

---

## Part 1: Automated E2E Coverage ✅

### Current Playwright Test Coverage

The following flows are already covered by automated E2E tests:

#### 1. **Basic Deployment Flows**

- ✅ **Hello World Deployment** (`deploy-hello-world.spec.ts`)

  - Complete deployment flow: template selection → deployment creation → lease creation → validation
  - Wallet connection and transaction signing
  - Deployment lifecycle management

- ✅ **Custom Template Deployment** (`deploy-custom-template.spec.ts`)

  - Custom container deployment with Ubuntu 24.04 image
  - Template selection and customization
  - Wallet connection verification

- ✅ **Linux Deployment** (`deploy-linux.spec.ts`)
  - SSH key generation and download
  - Ubuntu 24.04 distribution selection
  - Key pair validation

#### 2. **Wallet Management**

- ✅ **Wallet Switching** (`change-wallets.spec.ts`)

  - Creating new wallets in extension
  - Switching between wallets
  - Wallet state synchronization

- ✅ **Wallet Disconnection** (`disconnect-wallet.spec.ts`)
  - Disconnecting wallet
  - Persistence after page reload
  - Reconnection flow

#### 3. **Template Management**

- ✅ **Template Selection** (`deploy-from-a-template.spec.ts`)
  - Template gallery navigation
  - Template link validation
  - Template detail page access

#### 4. **SDL Builder**

- ✅ **SDL Builder Features** (`build-template.spec.ts`)
  - SSH function absence verification
  - Image name input validation
  - Component visibility checks

---

## Part 2: Manual Testing Required 🔍

### **Wallet Type Testing Strategy**

Most operations need to be tested for both wallet types:

- **Custodial Wallets** (Keplr, Leap, etc.) - User controls private keys
- **Managed Wallets** - Console manages wallet on behalf of user

---

### A. **Authentication & User Management**

#### A1. **Authentication Flows**

- [ ] **Sign Up Flow**

  - [ ] User clicks "Sign up" button
  - [ ] User is redirected to Auth0
  - [ ] User completes signup on Auth0
  - [ ] User is redirected back to console

- [ ] **Login Flow**

  - [ ] User clicks "Sign in" button
  - [ ] User is redirected to Auth0
  - [ ] User completes login on Auth0
  - [ ] User is redirected back to console

- [ ] **Logout Flow**
  - [ ] User clicks "Logout" button
  - [ ] User is logged out via Auth0
  - [ ] User is redirected to home page

#### A2. **Managed Wallet Onboarding Flow**

- [ ] **Onboarding Flow Variations**

  - [ ] **Flow 1: Unregistered User**

    - [ ] Starts at "Free Trial" step
    - [ ] Clicks "Start Free Trial" → redirects to Auth0 signup
    - [ ] After signup → lands on "Email Verification" step
    - [ ] Must verify email before proceeding to payment
    - [ ] Complete payment method setup
    - [ ] Clicks "Start Trial" → proceeds to "Welcome" step

  - [ ] **Flow 2: Registered User with Unverified Email**

    - [ ] Starts at "Free Trial" step (or saved step from localStorage)
    - [ ] Clicks "Start Free Trial" → redirects to Auth0 login
    - [ ] After login → lands on "Email Verification" step
    - [ ] Must verify email before proceeding to payment
    - [ ] Complete payment method setup
    - [ ] Clicks "Start Trial" → proceeds to "Welcome" step

  - [ ] **Flow 3: Registered User with Verified Email**
    - [ ] Starts at "Free Trial" step (or saved step from localStorage)
    - [ ] Clicks "Start Free Trial" → redirects to Auth0 login
    - [ ] After login → skips email verification, goes to "Payment Method" step
    - [ ] Complete payment method setup
    - [ ] Clicks "Start Trial" → proceeds to "Welcome" step

- [ ] **Onboarding Step Progression Flow**

  - [ ] User sees visual stepper showing current step
  - [ ] User sees progress bar indicating completion
  - [ ] User cannot skip prerequisite steps
  - [ ] User progress persists across browser sessions
  - [ ] User sees step completion tracking

- [ ] **Onboarding Completion Flow**
  - [ ] User sees success confirmation message
  - [ ] User receives next steps guidance
  - [ ] User sees feature introduction
  - [ ] User sees first deployment suggestion
  - [ ] User sees support resources

#### A3. **User Profile & Settings**

- [ ] **Profile Management Flow**
  - [ ] User clicks user avatar/icon in navigation
  - [ ] User sees dropdown menu with "Profile Settings" option
  - [ ] User clicks "Profile Settings" option
  - [ ] User navigates to profile settings page
  - [ ] User modifies username field
  - [ ] User updates bio text
  - [ ] User adds social media links (GitHub, Twitter, YouTube)
  - [ ] User toggles newsletter subscription
  - [ ] User clicks "Save Changes" button
  - [ ] User sees "Profile Updated" confirmation

### B. **Wallet Integration Flows**

#### B1. **Custodial Wallet Connection Flow** (Keplr, Leap, etc.)

- [ ] **Initial Wallet Connection**

  - [ ] User clicks "Connect Wallet" button
  - [ ] Wallet extension modal opens (Keplr/Leap/Cosmostation)
  - [ ] User selects account from wallet extension
  - [ ] User approves connection in wallet extension
  - [ ] Wallet connects and balance displays
  - [ ] User can proceed with deployments

- [ ] **Account Switching Flow**

  - [ ] User clicks wallet dropdown/avatar
  - [ ] User selects "Switch Account" option
  - [ ] Wallet extension modal opens with account list
  - [ ] User selects different account
  - [ ] New account connects and balance updates
  - [ ] Previous account data is cleared

- [ ] **Network Switching Flow**

  - [ ] User navigates to Settings page
  - [ ] User sees "Network" section with current network
  - [ ] User clicks network field (with dropdown arrow)
  - [ ] "Select Network" modal opens with radio buttons
  - [ ] User selects different network (Mainnet/SDK53 Testnet/Sandbox)
  - [ ] User clicks "Save" button to confirm change
  - [ ] App reconnects to new network
  - [ ] Wallet reconnects to new network
  - [ ] Balance refreshes for new network
  - [ ] Deployments list updates for new network

- [ ] **Wallet Disconnection Flow**
  - [ ] User clicks wallet dropdown/avatar
  - [ ] User selects "Disconnect" option
  - [ ] Wallet disconnects and balance clears
  - [ ] User remains on current page
  - [ ] Previous session data is cleared

#### B2. **Managed Wallet Flow**

- [ ] **Managed Wallet Creation Flow**

  - [ ] User completes onboarding with payment method
  - [ ] System automatically creates managed wallet
  - [ ] Managed wallet address is generated
  - [ ] Initial balance is set to $100 (trial amount)
  - [ ] User can add additional funds via payment methods

- [ ] **Managed Wallet Top-Up Flow**

  - [ ] User clicks "Add Funds" button (from home page or wallet popup)
  - [ ] User navigates to "Payment Methods" page via Add Funds button
  - [ ] User sees "Add credits" section with amount input field
  - [ ] User enters amount in "Amount (USD)" field
  - [ ] User can optionally enter coupon code
  - [ ] User clicks "Pay $X.XX" button to process payment
  - [ ] Payment processes successfully
  - [ ] User sees "Payment Successful!" confirmation screen
  - [ ] Balance updates automatically
  - [ ] User can proceed with deployments

- [ ] **Add New Payment Method Flow**
  - [ ] User clicks "Add New Payment Method" button (from Payment Methods page)
  - [ ] "Add New Payment Method" modal opens
  - [ ] User fills in billing address (Full name, Country, Address)
  - [ ] User selects payment method type (Card or Bank)
  - [ ] User enters card information (Card number, Expiration date, Security code)
  - [ ] User clicks "Add Card" button
  - [ ] Payment method is added successfully
  - [ ] User returns to Payment Methods page with new card listed

#### B3. **Wallet Type Switching Flow**

- [ ] **Custodial to Managed Switch**

  - [ ] User is using custodial wallet
  - [ ] User clicks "Switch to USD Payments" button
  - [ ] System switches to managed wallet
  - [ ] Managed wallet balance displays
  - [ ] User can add funds if needed

- [ ] **Managed to Custodial Switch**
  - [ ] User is using managed wallet
  - [ ] User clicks "Switch to Wallet Payments" button
  - [ ] Wallet connection modal opens
  - [ ] User connects custodial wallet
  - [ ] Custodial wallet balance displays
  - [ ] User can proceed with deployments

### C. **Deployment Management Flows**

#### C1. **Deployment Creation Flow** (Test with both Custodial & Managed Wallets)

- [ ] **Step 1: Template Selection**

  - [ ] User navigates to "New Deployment" page
  - [ ] User sees template gallery with categories (Build & Deploy, Launch Container-VM, Run Custom Container)
  - [ ] User selects a template (Hello World, Custom, Linux, etc.)
  - [ ] Template details and configuration options display
  - [ ] User clicks "Deploy" to proceed to Step 2

- [ ] **Step 2: Deployment Configuration**

  - [ ] User sees SDL editor with template pre-filled
  - [ ] User sees "Builder" and "YAML" tabs
  - [ ] **Builder Tab**: User configures service settings (image, command, environment variables)
  - [ ] **Builder Tab**: User allocates resources (CPU, memory, storage)
  - [ ] **Builder Tab**: User configures port exposure and networking
  - [ ] **Builder Tab**: User can add/remove services using form controls
  - [ ] **YAML Tab**: User can edit SDL directly in YAML format
  - [ ] **YAML Tab**: User sees syntax highlighting and real-time error detection
  - [ ] **YAML Tab**: User sees parsing error alerts if YAML is invalid
  - [ ] User can switch between Builder and YAML modes at any time
  - [ ] User clicks "Upload your SDL" button to upload .yml/.yaml/.txt file
  - [ ] User clicks "Create Deployment" to proceed to Step 3
  - [ ] **Custodial Wallet**: User sees transaction signing prompt
  - [ ] **Managed Wallet**: Transaction processes automatically
  - [ ] System validates SDL and checks prerequisites
  - [ ] System creates certificate if needed
  - [ ] Deployment is created and user sees success message

- [ ] **Step 3: Provider Selection**
  - [ ] User sees list of available providers with pricing
  - [ ] User can filter providers by criteria (Favorites, Audited)
  - [ ] User can search for specific providers
  - [ ] User sees provider details (uptime, region, price)
  - [ ] User selects preferred provider(s)
  - [ ] User clicks "Accept Bid" to create lease
  - [ ] System creates lease with selected provider
  - [ ] User sees deployment status and can monitor progress

#### C2. **Deployment Management Flow** (Test with both Custodial & Managed Wallets)

- [ ] **Deployment Status Monitoring Flow**

  - [ ] User navigates to "My Deployments" page
  - [ ] User sees list of active deployments
  - [ ] User clicks on deployment to view details
  - [ ] User sees deployment status, logs, events
  - [ ] User can monitor remaining escrow balance of the deployment

- [ ] **Deployment Update Flow**

  - [ ] User clicks "Edit" on existing deployment
  - [ ] User modifies SDL configuration
  - [ ] **Custodial Wallet**: User signs update transaction
  - [ ] **Managed Wallet**: Update processes automatically
  - [ ] Deployment updates and user sees confirmation

- [ ] **Deployment Closure Flow**

  - [ ] User clicks "Close Deployment" button
  - [ ] User confirms closure action
  - [ ] **Custodial Wallet**: User signs closure transaction
  - [ ] **Managed Wallet**: Closure processes automatically
  - [ ] Deployment closes and funds are returned
  - [ ] User sees closure confirmation

- [ ] **Auto Top-Up Configuration Flow** (Custodial Wallets Only)
  - [ ] User navigates to deployment details page
  - [ ] User sees "Auto top-up" toggle switch next to "Add funds" button
  - [ ] User can enable/disable auto top-up for deployment
  - [ ] User sees tooltip with auto top-up details:
    - [ ] Estimated amount (e.g., "$0.001088")
    - [ ] Check period (e.g., "1 hour")
    - [ ] Explanation is shown
  - [ ] System automatically tops up deployment when funds are low

### D. **Provider Management**

#### D1. **Provider Discovery**

- [ ] **Provider Discovery Flow**

  - [ ] User navigates to "Providers" page
  - [ ] User sees paginated list of providers
  - [ ] User uses search bar to find specific providers
  - [ ] User applies filters (location, resources, price)
  - [ ] User sorts providers by criteria
  - [ ] User sees provider status indicators (online/offline)

- [ ] **Provider Details Flow**
  - [ ] User clicks on provider from list
  - [ ] User sees detailed provider information
  - [ ] User views resource availability
  - [ ] User checks pricing information
  - [ ] User reviews performance metrics

#### D2. **Provider Operations**

- [ ] **Provider Information Flow**
  - [ ] User views provider details and specifications
  - [ ] User checks provider uptime and performance metrics
  - [ ] User reviews provider pricing and availability

### E. **Billing & Payment**

#### E1. **Payment Methods** (Managed Wallets Only)

- [ ] **Payment Method Management Flow** (Managed Wallets Only)
  - [ ] User navigates to "Payment Methods" page via Add Funds button
  - [ ] User clicks "Add Payment Method" button
  - [ ] User enters credit card details
  - [ ] User fills in billing information
  - [ ] User clicks "Add Card" button
  - [ ] User sees "Payment Method Added" confirmation
  - [ ] System validates payment methods (duplicate cards not allowed in production)

#### E2. **Billing & Usage Flow** (Managed Wallets Only)

- [ ] **Billing & Usage Dashboard Flow** (Managed Wallets Only)
  - [ ] User navigates to "Billing & Usage" page
  - [ ] User sees "Billing" and "Usage" tabs
  - [ ] **Billing Tab**: User views transaction history table
  - [ ] **Billing Tab**: User can filter by date range
  - [ ] **Billing Tab**: User can export CSV of transactions
  - [ ] **Usage Tab**: User views overview with total spent and deployments
  - [ ] **Usage Tab**: User sees daily usage chart
  - [ ] **Usage Tab**: User sees cumulative spending chart
  - [ ] **Usage Tab**: User can export CSV of usage data

### F. **Alerts & Notifications**

#### F1. **Alert Management**

- [ ] **Alert Creation Flow**

  - [ ] User navigates to deployment detail page
  - [ ] User clicks "Alerts" tab within deployment
  - [ ] User sees "Configure Alerts" section
  - [ ] User enables "Escrow Balance" alert checkbox
  - [ ] User sets threshold amount in USD field
  - [ ] User selects notification channel (Primary account email)
  - [ ] User enables "Deployment Close" alert checkbox
  - [ ] User selects notification channel for deployment close
  - [ ] User clicks "Save Changes" button
  - [ ] User sees alert configuration saved

- [ ] **Alert Viewing Flow**

  - [ ] User navigates to "Alerts" page
  - [ ] User sees "Configured Alerts" table
  - [ ] User can view all configured alerts with details:
    - [ ] Enabled status (checkbox)
    - [ ] Deployment name
    - [ ] DSEQ number
    - [ ] Alert type (Deployment Close, Escrow Threshold)
    - [ ] Status (Ok)
    - [ ] Notification channel (Primary account email)
  - [ ] User can toggle between "Alerts" and "Notification Channels" tabs

- [ ] **Escrow Balance Alert Flow**

  - [ ] User creates "Escrow Balance" alert
  - [ ] User sets balance threshold in USD
  - [ ] User configures notification preferences
  - [ ] User receives alert when balance drops below threshold

- [ ] **Deployment Close Alert Flow**

  - [ ] User creates "Deployment Close" alert
  - [ ] User sets alert conditions
  - [ ] User configures notification preferences
  - [ ] User receives alert when deployment closes

- [ ] **Alert Management Flow**
  - [ ] User navigates to "Alerts" page
  - [ ] User sees "Configured Alerts" table
  - [ ] User clicks on deployment name in alerts table
  - [ ] User navigates to deployment detail page
  - [ ] User clicks "Alerts" tab within deployment
  - [ ] User sees "Configure Alerts" section with current settings
  - [ ] User modifies alert settings (threshold, notification channels)
  - [ ] User clicks "Save Changes" button
  - [ ] User sees alert configuration updated

#### F2. **Notification Channels**

- [ ] **Notification Channel Management Flow**

  - [ ] User navigates to "Alerts" page
  - [ ] User clicks "Notification Channels" tab
  - [ ] User sees "Notification Channels" table with existing channels:
    - [ ] Name (e.g., "Primary account email", "Default")
    - [ ] Type (e.g., "email")
    - [ ] Addresses (e.g., email addresses)
    - [ ] Edit icon (pencil) and Delete icon (trash) for each channel
  - [ ] User clicks "+ Create" button to add new channel
  - [ ] User fills in channel name and email addresses
  - [ ] User clicks "Save" button
  - [ ] User sees new channel added to table

- [ ] **Notification Channel Edit Flow**
  - [ ] User clicks edit icon (pencil) on existing channel
  - [ ] User navigates to "Edit Notification Channel" page
  - [ ] User sees pre-filled form with current channel details
  - [ ] User modifies channel name in "Name" field
  - [ ] User modifies email addresses in "Emails" field
  - [ ] User clicks "Save" button to save changes
  - [ ] User clicks "Cancel" button to discard changes
  - [ ] User returns to Notification Channels table with updated information

### G. **Standalone SDL Builder** (Template Creation)

#### G1. **Template Builder**

- [ ] **Template Creation Flow**

  - [ ] User navigates to standalone SDL Builder page
  - [ ] User sees visual form for configuring services
  - [ ] User configures service settings (image, command, environment variables)
  - [ ] User allocates resources (CPU, memory, storage)
  - [ ] User configures port exposure and networking
  - [ ] User can add/remove services using form controls
  - [ ] User clicks "Deploy" to proceed to deployment creation
  - [ ] User clicks "Save" to save as template
  - [ ] User clicks "Preview" to see generated SDL
  - [ ] User clicks "Import" to import existing SDL
  - [ ] User clicks "Reset" to clear form and start over

---

## Test Execution Guidelines

### 1. **Test Planning**

- [ ] Prioritize critical user journeys

### 2. **Test Execution**

- [ ] Follow test cases systematically
- [ ] Document all issues found
- [ ] Capture screenshots/videos for bugs
- [ ] Test both positive and negative scenarios

### 3. **Issue Reporting**

- [ ] Document issue severity
- [ ] Provide reproduction steps
- [ ] Include environment details
- [ ] Suggest potential fixes

### 4. **Test Completion**

- [ ] Verify all critical issues are resolved
- [ ] Confirm feature functionality
- [ ] Validate performance requirements
- [ ] Sign off on release readiness

---

## Success Criteria

### Critical Issues (Must Fix)

- [ ] Authentication failures
- [ ] Payment processing errors
- [ ] Deployment creation failures
- [ ] Data loss or corruption
- [ ] Security vulnerabilities

### High Priority Issues (Should Fix)

- [ ] Performance degradation
- [ ] Usability problems
- [ ] Error handling issues
- [ ] Cross-browser compatibility
- [ ] Mobile responsiveness

### Medium Priority Issues (Nice to Fix)

- [ ] UI/UX improvements
- [ ] Additional validation
- [ ] Enhanced error messages
- [ ] Performance optimizations
- [ ] Accessibility enhancements

---

## **Wallet Testing Summary**

### **Testing Strategy Overview**

Most operations in the deploy-web application need to be tested with both wallet types to ensure comprehensive coverage:

### **Key Testing Areas by Wallet Type**

| Feature Area                  | Custodial Wallets | Managed Wallets | Both Types |
| ----------------------------- | ----------------- | --------------- | ---------- |
| **Authentication**            | ✅                | ✅              | ✅         |
| **Managed Wallet Onboarding** | ❌                | ✅              | ❌         |
| **Wallet Connection**         | ✅                | ✅              | ✅         |
| **Deployment Creation**       | ✅                | ✅              | ✅         |
| **Deployment Management**     | ✅                | ✅              | ✅         |
| **Billing & Payments**        | ❌                | ✅              | ❌         |
| **Alerts & Notifications**    | ✅                | ✅              | ✅         |
| **SDL Builder**               | ✅                | ✅              | ✅         |

---

_This checklist should be reviewed and updated regularly as new features are added and existing functionality evolves._
