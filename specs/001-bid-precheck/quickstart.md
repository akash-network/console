# Quickstart: Bid Screening

**Feature**: Bid Screening
**Date**: 2026-04-27

## Prerequisites

- Node.js >= 24.14.1 (Volta manages this)
- npm 11.11.0
- PostgreSQL running with provider data (indexer populated)
- Docker Compose services up: `npm run dc:up:dev -- api`

## Running the API

```bash
# From repo root
npm run api:dev
```

The API starts on `http://localhost:3080` (or configured port).

## Testing the Endpoint

### Basic screening (CPU + memory only)

```bash
curl -X POST http://localhost:3080/v1/bid-screening \
  -H "Content-Type: application/json" \
  -d '{
    "name": "westcoast",
    "requirements": {
      "signedBy": { "allOf": [], "anyOf": [] },
      "attributes": []
    },
    "resources": [{
      "resource": {
        "id": 1,
        "cpu": { "units": { "val": "1000" }, "attributes": [] },
        "memory": { "quantity": { "val": "1073741824" }, "attributes": [] },
        "gpu": { "units": { "val": "0" }, "attributes": [] },
        "storage": [{
          "name": "default",
          "quantity": { "val": "5368709120" },
          "attributes": [
            { "key": "persistent", "value": "false" },
            { "key": "class", "value": "ephemeral" }
          ]
        }],
        "endpoints": []
      },
      "count": 1,
      "price": { "denom": "uakt", "amount": "1000" }
    }]
  }'
```

### GPU screening (NVIDIA A100)

```bash
curl -X POST http://localhost:3080/v1/bid-screening \
  -H "Content-Type: application/json" \
  -d '{
    "name": "westcoast",
    "requirements": {
      "signedBy": { "allOf": [], "anyOf": [] },
      "attributes": []
    },
    "resources": [{
      "resource": {
        "id": 1,
        "cpu": { "units": { "val": "8000" }, "attributes": [] },
        "memory": { "quantity": { "val": "17179869184" }, "attributes": [] },
        "gpu": {
          "units": { "val": "1" },
          "attributes": [
            { "key": "vendor/nvidia/model/a100", "value": "true" }
          ]
        },
        "storage": [{
          "name": "default",
          "quantity": { "val": "10737418240" },
          "attributes": [
            { "key": "persistent", "value": "false" },
            { "key": "class", "value": "ephemeral" }
          ]
        }],
        "endpoints": []
      },
      "count": 1,
      "price": { "denom": "uakt", "amount": "5000" }
    }]
  }'
```

### With attribute filtering

```bash
curl -X POST http://localhost:3080/v1/bid-screening \
  -H "Content-Type: application/json" \
  -d '{
    "name": "westcoast",
    "requirements": {
      "signedBy": {
        "allOf": ["akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63"],
        "anyOf": []
      },
      "attributes": [
        { "key": "tier", "value": "community" }
      ]
    },
    "resources": [{
      "resource": {
        "id": 1,
        "cpu": { "units": { "val": "1000" }, "attributes": [] },
        "memory": { "quantity": { "val": "1073741824" }, "attributes": [] },
        "gpu": { "units": { "val": "0" }, "attributes": [] },
        "storage": [{
          "name": "default",
          "quantity": { "val": "5368709120" },
          "attributes": [
            { "key": "persistent", "value": "false" },
            { "key": "class", "value": "ephemeral" }
          ]
        }],
        "endpoints": []
      },
      "count": 1,
      "price": { "denom": "uakt", "amount": "1000" }
    }]
  }'
```

## Running Tests

```bash
# Unit tests
cd apps/api
npm run test:unit -- --filter bid-screening

# Functional tests (requires Docker services)
npm run test:ci-setup
npm run test:functional -- --filter bid-screening
npm run test:ci-teardown

# All tests
npm test
```

## Expected Response

```json
{
  "providers": [
    {
      "owner": "akash1q7spv2cw06yszgfp4f9ed59lkka6ytn8g4tkjf",
      "hostUri": "https://provider.europlots.com:8443",
      "region": "eu-west",
      "uptime7d": 0.998,
      "isAudited": true
    },
    {
      "owner": "akash18ga02jzaq8cw52anyhz6gc29pfxfv69d6mnp0l",
      "hostUri": "https://provider.akash.world:8443",
      "region": "us-east",
      "uptime7d": 0.995,
      "isAudited": false
    }
  ]
}
```

An empty `providers` array means no providers can fulfil the
deployment requirements. This is not an error.
