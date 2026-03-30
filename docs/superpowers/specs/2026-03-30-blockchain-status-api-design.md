# Blockchain Status API Endpoint

## Summary

Add a public `GET /v1/blockchain-status` endpoint to `apps/api` that reports whether the blockchain RPC node is reachable. Update `apps/stats-web` to consume this endpoint instead of pinging the blockchain directly.

## Motivation

Stats-web currently pings the blockchain from the browser via a two-step process: fetch node config from `/api/blockchain-config`, then hit `/cosmos/base/tendermint/v1beta1/node_info` directly. This couples the frontend to blockchain infrastructure. Moving the check server-side simplifies the frontend and centralizes blockchain connectivity logic.

## API Design

### Endpoint

- **Method:** GET
- **Path:** `/v1/blockchain-status`
- **Auth:** Public (no authentication required)
- **OpenAPI tag:** `"Chain"`

### Response

Always returns HTTP 200. The boolean carries the health signal.

```json
{ "isBlockchainReachable": true }
```

or

```json
{ "isBlockchainReachable": false }
```

### Response Schema (Zod)

```typescript
z.object({
  isBlockchainReachable: z.boolean()
})
```

## API Implementation (`apps/api`)

### Architecture

Uses the existing `src/chain/` module. Follows the standard router -> controller -> service pattern.

### New Files

- `src/chain/routes/blockchain-status/blockchain-status.router.ts` — OpenAPI route definition, resolves controller, returns JSON
- `src/chain/controllers/blockchain-status/blockchain-status.controller.ts` — delegates to service
- `src/chain/services/blockchain-status/blockchain-status.service.ts` — injects `CHAIN_SDK`, calls `getNodeInfo()`, returns result

### Service Logic

```
1. Inject CHAIN_SDK (already registered in src/chain/providers/chain-sdk.provider.ts)
2. Call chainSdk.cosmos.base.tendermint.v1beta1.getNodeInfo()
   - chain-sdk has built-in retry: 3 attempts, exponential backoff
3. On success: return { isBlockchainReachable: true }
4. On error (after retries exhausted): return { isBlockchainReachable: false }
```

### Registration

Add the new router to the `openApiHonoHandlers` array in `src/rest-app.ts`.

## Stats-web Changes (`apps/stats-web`)

### Modified Files

- `src/hooks/useTopBanner.tsx` — replace two-step blockchain ping with single `GET /v1/blockchain-status` call. Keep 5-minute polling interval. Read `isBlockchainReachable` from response.

### Removed Files

- `src/app/api/blockchain-config/route.ts` — Next.js API route no longer needed

### Removed Constants

- `DEFAULT_REST_API_NODE_URL_MAINNET` from `src/config/env-config.schema.ts`
- `DEFAULT_RPC_NODE_URL_MAINNET` from `src/config/env-config.schema.ts`

### Not Modified

- `packages/network-store` — `nodesUrl` stays; other apps (deploy-web) may use it
- Network types — unchanged

## Technical Notes

- Git worktrees will be used for implementation
- Commit messages use `refactor:` prefix
- chain-sdk retry handles transient failures automatically; no additional retry logic needed in the service
