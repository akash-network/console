# Blockchain Status API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `GET /v1/blockchain-status` endpoint to the API that reports blockchain reachability, then update stats-web to use it instead of pinging the blockchain directly.

**Architecture:** A new route/controller/service in the existing `apps/api/src/chain/` module. The service uses the already-registered `CHAIN_SDK` to call `getNodeInfo()` with built-in retry. Stats-web replaces its two-step blockchain ping with a single API call.

**Tech Stack:** Hono, tsyringe, zod, @akashnetwork/chain-sdk, vitest, React/axios

---

### Task 1: Blockchain Status Service (TDD)

**Files:**
- Create: `apps/api/src/chain/services/blockchain-status/blockchain-status.service.ts`
- Create: `apps/api/src/chain/services/blockchain-status/blockchain-status.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/chain/services/blockchain-status/blockchain-status.service.spec.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

import { BlockchainStatusService } from "./blockchain-status.service";

describe(BlockchainStatusService.name, () => {
  it("returns isBlockchainReachable true when getNodeInfo succeeds", async () => {
    const { service } = setup({ succeeds: true });

    const result = await service.getStatus();

    expect(result).toEqual({ isBlockchainReachable: true });
  });

  it("returns isBlockchainReachable false when getNodeInfo fails", async () => {
    const { service } = setup({ succeeds: false });

    const result = await service.getStatus();

    expect(result).toEqual({ isBlockchainReachable: false });
  });

  function setup(input: { succeeds: boolean }) {
    const getNodeInfo = input.succeeds
      ? vi.fn().mockResolvedValue({ applicationVersion: { version: "1.0.0" } })
      : vi.fn().mockRejectedValue(new Error("Connection refused"));

    const chainSdk = {
      cosmos: {
        base: {
          tendermint: {
            v1beta1: { getNodeInfo }
          }
        }
      }
    };

    const service = new BlockchainStatusService(chainSdk as any);

    return { service, getNodeInfo };
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run src/chain/services/blockchain-status/blockchain-status.service.spec.ts`
Expected: FAIL — cannot find `./blockchain-status.service`

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/chain/services/blockchain-status/blockchain-status.service.ts`:

```typescript
import { inject, singleton } from "tsyringe";

import { CHAIN_SDK, type ChainSDK } from "../../providers/chain-sdk.provider";

@singleton()
export class BlockchainStatusService {
  constructor(@inject(CHAIN_SDK) private readonly chainSdk: ChainSDK) {}

  async getStatus(): Promise<{ isBlockchainReachable: boolean }> {
    try {
      await this.chainSdk.cosmos.base.tendermint.v1beta1.getNodeInfo();
      return { isBlockchainReachable: true };
    } catch {
      return { isBlockchainReachable: false };
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/chain/services/blockchain-status/blockchain-status.service.spec.ts`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/chain/services/blockchain-status/
git commit -m "refactor(stats): add blockchain status service with tests"
```

---

### Task 2: Blockchain Status Controller

**Files:**
- Create: `apps/api/src/chain/controllers/blockchain-status/blockchain-status.controller.ts`

- [ ] **Step 1: Create the controller**

Create `apps/api/src/chain/controllers/blockchain-status/blockchain-status.controller.ts`:

```typescript
import { singleton } from "tsyringe";

import { BlockchainStatusService } from "../../services/blockchain-status/blockchain-status.service";

@singleton()
export class BlockchainStatusController {
  constructor(private readonly blockchainStatusService: BlockchainStatusService) {}

  async getStatus() {
    return this.blockchainStatusService.getStatus();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/chain/controllers/blockchain-status/
git commit -m "refactor(stats): add blockchain status controller"
```

---

### Task 3: Blockchain Status Router + Registration

**Files:**
- Create: `apps/api/src/chain/routes/blockchain-status/blockchain-status.router.ts`
- Modify: `apps/api/src/rest-app.ts`

- [ ] **Step 1: Create the router**

Create `apps/api/src/chain/routes/blockchain-status/blockchain-status.router.ts`:

```typescript
import { container } from "tsyringe";
import { z } from "zod";

import { BlockchainStatusController } from "@src/chain/controllers/blockchain-status/blockchain-status.controller";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

const blockchainStatusResponseSchema = z.object({
  isBlockchainReachable: z.boolean()
});

const route = createRoute({
  method: "get",
  path: "/v1/blockchain-status",
  summary: "Get blockchain reachability status",
  tags: ["Chain"],
  security: SECURITY_NONE,
  request: {},
  responses: {
    200: {
      description: "Returns blockchain reachability status",
      content: {
        "application/json": {
          schema: blockchainStatusResponseSchema
        }
      }
    }
  }
});

export const blockchainStatusRouter = new OpenApiHonoHandler();

blockchainStatusRouter.openapi(route, async function routeGetBlockchainStatus(c) {
  const result = await container.resolve(BlockchainStatusController).getStatus();
  return c.json(result, 200);
});
```

- [ ] **Step 2: Register the router in rest-app.ts**

In `apps/api/src/rest-app.ts`, add the import at the top alongside other chain imports:

```typescript
import { blockchainStatusRouter } from "./chain/routes/blockchain-status/blockchain-status.router";
```

Add `blockchainStatusRouter` to the `openApiHonoHandlers` array (after `networkRouter`):

```typescript
  networkRouter,
  blockchainStatusRouter
];
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/chain/routes/blockchain-status/ apps/api/src/rest-app.ts
git commit -m "refactor(stats): add blockchain status route and register in rest-app"
```

---

### Task 4: Update stats-web useTopBanner to use API endpoint

**Files:**
- Modify: `apps/stats-web/src/hooks/useTopBanner.tsx`
- Modify: `apps/stats-web/src/lib/apiUtils.ts`

- [ ] **Step 1: Add blockchainStatus method to ApiUrlService**

In `apps/stats-web/src/lib/apiUtils.ts`, add a new static method inside the `ApiUrlService` class (after the existing methods, before the `baseApiUrl` getter):

```typescript
  static blockchainStatus() {
    return `${this.baseApiUrl}/v1/blockchain-status`;
  }
```

- [ ] **Step 2: Update useTopBanner.tsx to use the new endpoint**

In `apps/stats-web/src/hooks/useTopBanner.tsx`:

Replace the import of `networkStore`:

```typescript
// Remove this import:
import { networkStore } from "@/store/network.store";

// Add this import:
import { ApiUrlService } from "@/lib/apiUtils";
```

Replace the `pingBlockchainNode` function and its `useEffect` (lines 42-69) with:

```typescript
  let timeoutId: NodeJS.Timeout | undefined;
  useEffect(() => {
    function pingBlockchainNode() {
      axios
        .get<{ isBlockchainReachable: boolean }>(ApiUrlService.blockchainStatus())
        .then(response => {
          setIsBlockchainDown(!response.data.isBlockchainReachable);
        })
        .catch(() => {
          setIsBlockchainDown(true);
        });

      timeoutId = setTimeout(pingBlockchainNode, 5 * 60_000);
    }

    pingBlockchainNode();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [setIsBlockchainDown]);
```

Also remove the line `const chainNetwork = networkStore.useSelectedNetwork();` (line 22) since it's no longer used.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/stats-web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/stats-web/src/hooks/useTopBanner.tsx apps/stats-web/src/lib/apiUtils.ts
git commit -m "refactor(stats): use blockchain-status API endpoint in useTopBanner"
```

---

### Task 5: Remove redundant blockchain-config route and constants

**Files:**
- Delete: `apps/stats-web/src/app/api/blockchain-config/route.ts`
- Modify: `apps/stats-web/src/config/env-config.schema.ts`

- [ ] **Step 1: Delete the blockchain-config route**

Delete the file `apps/stats-web/src/app/api/blockchain-config/route.ts`.

- [ ] **Step 2: Remove redundant constants from env-config.schema.ts**

In `apps/stats-web/src/config/env-config.schema.ts`, remove the two lines from the `serverEnvSchema.extend({})` call:

```typescript
  DEFAULT_REST_API_NODE_URL_MAINNET: z.string().url(),
  DEFAULT_RPC_NODE_URL_MAINNET: z.string().url()
```

The resulting `serverEnvSchema` should be:

```typescript
export const serverEnvSchema = browserEnvSchema.extend({
  MAINTENANCE_MODE: coercedBoolean().optional().default("false"),
  BASE_API_MAINNET_URL: z.string().url(),
  BASE_API_TESTNET_URL: z.string().url(),
  BASE_API_SANDBOX_URL: z.string().url()
});
```

Also remove the unused import of `serverEnvConfig` from `apps/stats-web/src/app/api/blockchain-config/route.ts` — this import lives in the deleted file so no action needed.

- [ ] **Step 3: Check for any remaining references to removed code**

Search for `DEFAULT_REST_API_NODE_URL_MAINNET` and `DEFAULT_RPC_NODE_URL_MAINNET` in `apps/stats-web/` to confirm no other files reference them. Also search for `blockchain-config` to confirm no other stats-web code references the deleted route (the `nodesUrl` in `packages/network-store` is expected and should not be modified).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/stats-web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/stats-web/src/app/api/blockchain-config/route.ts apps/stats-web/src/config/env-config.schema.ts
git commit -m "refactor(stats): remove redundant blockchain-config route and env constants"
```

---

### Task 6: Run all tests and verify

**Files:** None (verification only)

- [ ] **Step 1: Run API unit tests**

Run: `cd apps/api && npm run test:unit`
Expected: All tests pass

- [ ] **Step 2: Run blockchain-status service tests specifically**

Run: `cd apps/api && npx vitest run src/chain/services/blockchain-status/blockchain-status.service.spec.ts`
Expected: 2 tests pass

- [ ] **Step 3: Run stats-web type check**

Run: `cd apps/stats-web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run stats-web lint**

Run: `cd apps/stats-web && npm run lint`
Expected: No errors
