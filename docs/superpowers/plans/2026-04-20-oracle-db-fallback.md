# Oracle DB Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DB fallback to `DenomExchangeService.getExchangeRateToUSD()` so `/v1/market-data` returns pricing even when the on-chain oracle is unhealthy or unreachable.

**Architecture:** Wrap the existing oracle RPC calls in a try/catch. On success, check `priceHealth?.isHealthy` — if false, fall back to `day.aktPrice` from DB with a warning log. On RPC exception, fall back the same way with a different warning log. Both paths return the same response shape.

**Tech Stack:** TypeScript, tsyringe DI, Sequelize (Day model), Vitest, vitest-mock-extended

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/src/gpu/repositories/day.repository.ts` | Modify | Add `getLatestAktPrice()` method |
| `apps/api/src/chain/services/denom-exchange/denom-exchange.service.ts` | Modify | Add DayRepository + LoggerService deps, wrap oracle in try/catch, add health check, add DB fallback |
| `apps/api/src/chain/services/denom-exchange/denom-exchange.service.spec.ts` | Modify | Add tests for unhealthy, RPC failure, and no-DB-price scenarios |

---

### Task 1: Add `getLatestAktPrice()` to DayRepository

**Files:**
- Modify: `apps/api/src/gpu/repositories/day.repository.ts`

- [ ] **Step 1: Add the `getLatestAktPrice` method**

Open `apps/api/src/gpu/repositories/day.repository.ts` and add the new method. The file should become:

```typescript
import { Day } from "@akashnetwork/database/dbSchemas/base";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

@singleton()
export class DayRepository {
  async getDaysAfter(date: Date): Promise<Day[]> {
    return await Day.findAll({ where: { date: { [Op.gte]: date } }, raw: true });
  }

  async getLatestAktPrice(): Promise<number | null> {
    const day = await Day.findOne({
      where: { aktPrice: { [Op.ne]: null } },
      order: [["date", "DESC"]],
      attributes: ["aktPrice"],
      raw: true
    });

    return day?.aktPrice ?? null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/gpu/repositories/day.repository.ts
git commit -m "feat(api): add getLatestAktPrice to DayRepository"
```

---

### Task 2: Update existing tests to account for new constructor dependencies

**Files:**
- Modify: `apps/api/src/chain/services/denom-exchange/denom-exchange.service.spec.ts`

The `setup` function currently creates `DenomExchangeService` with only `chainSdk`. After Task 3, the constructor will require `DayRepository` and `LoggerService` too. Update the existing tests first so they keep passing after the implementation change.

- [ ] **Step 1: Update imports and setup function**

Replace the entire content of `apps/api/src/chain/services/denom-exchange/denom-exchange.service.spec.ts` with:

```typescript
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { DayRepository } from "@src/gpu/repositories/day.repository";
import { DenomExchangeService } from "./denom-exchange.service";

describe(DenomExchangeService.name, () => {
  describe("getExchangeRateToUSD", () => {
    it("returns oracle price data", async () => {
      const { service, getAggregatedPrice, getPrices } = setup({});

      const result = await service.getExchangeRateToUSD("akt");

      expect(getAggregatedPrice).toHaveBeenCalled();
      expect(getPrices).toHaveBeenCalled();
      expect(result).toEqual({
        price: 0.56,
        volume: 0,
        marketCap: 0,
        marketCapRank: 0,
        priceChange24h: 0.56 - 0.5,
        priceChangePercentage24: ((0.56 - 0.5) / 0.5) * 100
      });
    });

    it("calculates block height 24h ago for historical price lookup", async () => {
      const { service, getPrices } = setup({ currentHeight: 100000n });

      await service.getExchangeRateToUSD("akt");

      const expectedHeight = 100000n - (24n * 60n * 60n) / 6n;
      expect(getPrices).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ height: expectedHeight })
        })
      );
    });

    it("returns zero price change when historical price is zero", async () => {
      const { service } = setup({ historicalPrice: "0" });

      const result = await service.getExchangeRateToUSD("akt");

      expect(result.priceChange24h).toBe(0.56);
      expect(result.priceChangePercentage24).toBe(0);
    });

    it("returns zero price change when no historical prices available", async () => {
      const { service } = setup({ emptyHistoricalPrices: true });

      const result = await service.getExchangeRateToUSD("akt");

      expect(result.priceChange24h).toBe(0);
      expect(result.priceChangePercentage24).toBe(0);
    });
  });

  function setup(input: {
    currentHeight?: bigint;
    historicalPrice?: string;
    emptyHistoricalPrices?: boolean;
    isHealthy?: boolean;
    oracleThrows?: boolean;
    latestAktPrice?: number | null;
  }) {
    const getLatestBlock = vi.fn().mockResolvedValue({
      block: { header: { height: { toBigInt: () => input.currentHeight ?? 1000000n } } }
    });
    const getAggregatedPrice = vi.fn().mockResolvedValue({
      aggregatedPrice: { medianPrice: "0.56" },
      priceHealth: { isHealthy: input.isHealthy ?? true }
    });
    const getPrices = vi.fn().mockResolvedValue({
      prices: input.emptyHistoricalPrices ? [] : [{ state: { price: input.historicalPrice ?? "0.5" } }]
    });

    if (input.oracleThrows) {
      getLatestBlock.mockRejectedValue(new Error("RPC connection refused"));
    }

    const chainSdk = mockDeep<ChainSDK>();
    chainSdk.cosmos.base.tendermint.v1beta1.getLatestBlock.mockImplementation(getLatestBlock);
    chainSdk.akash.oracle.v1.getAggregatedPrice.mockImplementation(getAggregatedPrice);
    chainSdk.akash.oracle.v1.getPrices.mockImplementation(getPrices);

    const dayRepository = mock<DayRepository>();
    dayRepository.getLatestAktPrice.mockResolvedValue(input.latestAktPrice ?? 1.23);

    const logger = mock<LoggerService>();

    const service = new DenomExchangeService(chainSdk, dayRepository, logger);

    return { service, getLatestBlock, getAggregatedPrice, getPrices, dayRepository, logger };
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run src/chain/services/denom-exchange/denom-exchange.service.spec.ts`

Expected: FAIL — `DenomExchangeService` constructor doesn't accept `dayRepository` and `logger` yet.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/chain/services/denom-exchange/denom-exchange.service.spec.ts
git commit -m "test(api): update DenomExchangeService setup for new dependencies"
```

---

### Task 3: Add fallback logic to DenomExchangeService

**Files:**
- Modify: `apps/api/src/chain/services/denom-exchange/denom-exchange.service.ts`

- [ ] **Step 1: Implement the fallback**

Replace the entire content of `apps/api/src/chain/services/denom-exchange/denom-exchange.service.ts` with:

```typescript
import { minutesToMilliseconds } from "date-fns";
import { inject, singleton } from "tsyringe";

import { memoizeAsync } from "@src/caching/helpers";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { LoggerService } from "@src/core/providers/logging.provider";
import { DayRepository } from "@src/gpu/repositories/day.repository";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class DenomExchangeService {
  readonly #chainSdk: ChainSDK;
  readonly #dayRepository: DayRepository;
  readonly #logger: LoggerService;

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK, dayRepository: DayRepository, logger: LoggerService) {
    this.#chainSdk = chainSdk;
    this.#dayRepository = dayRepository;
    this.#logger = logger;
  }

  getExchangeRateToUSD = memoizeAsync(
    async (denom: "akt" | "akash-network") => {
      const legacyToNewMapping: Record<string, string> = {
        "akash-network": "akt"
      };
      const mappedDenom = legacyToNewMapping[denom] ?? denom;

      let currentRate;
      try {
        const latestBlock = await this.#chainSdk.cosmos.base.tendermint.v1beta1.getLatestBlock();
        const currentHeight = latestBlock.block?.header?.height?.toBigInt() ?? 0n;
        const blocksPerDay = (24n * 60n * 60n) / BigInt(Math.ceil(averageBlockTime));
        const blockHeight24hAgo = currentHeight > blocksPerDay ? currentHeight - blocksPerDay : 1n;
        const [oracleRate, rate24hAgo] = await Promise.all([
          this.#chainSdk.akash.oracle.v1.getAggregatedPrice({ denom: mappedDenom }),
          this.#chainSdk.akash.oracle.v1.getPrices({
            filters: { assetDenom: mappedDenom, baseDenom: "usd", height: blockHeight24hAgo },
            pagination: { limit: 1 }
          })
        ]);

        if (!oracleRate.priceHealth?.isHealthy) {
          this.#logger.warn({ event: "ORACLE_PRICE_UNHEALTHY", denom: mappedDenom });
          return this.#getFallbackPrice();
        }

        const price = parseFloat(oracleRate.aggregatedPrice?.medianPrice ?? "0");
        const price24hAgo = rate24hAgo.prices[0]?.state?.price ? parseFloat(rate24hAgo.prices[0].state.price) : price;

        return {
          price,
          volume: 0,
          marketCap: 0,
          marketCapRank: 0,
          priceChange24h: price - price24hAgo,
          priceChangePercentage24: price24hAgo ? ((price - price24hAgo) / price24hAgo) * 100 : 0
        };
      } catch (error) {
        this.#logger.warn({ event: "ORACLE_RPC_FAILED", denom: mappedDenom, error });
        return this.#getFallbackPrice();
      }
    },
    { cacheItemLimit: 10, ttl: minutesToMilliseconds(10) }
  );

  async #getFallbackPrice() {
    const aktPrice = await this.#dayRepository.getLatestAktPrice();

    return {
      price: aktPrice ?? 0,
      volume: 0,
      marketCap: 0,
      marketCapRank: 0,
      priceChange24h: 0,
      priceChangePercentage24: 0
    };
  }
}
```

- [ ] **Step 2: Run existing tests to verify they pass**

Run: `cd apps/api && npx vitest run src/chain/services/denom-exchange/denom-exchange.service.spec.ts`

Expected: All 4 existing tests PASS. The happy-path tests provide `isHealthy: true` (default in setup), so they continue through the oracle path.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/chain/services/denom-exchange/denom-exchange.service.ts
git commit -m "feat(api): add DB fallback to DenomExchangeService when oracle unavailable"
```

---

### Task 4: Add fallback unit tests

**Files:**
- Modify: `apps/api/src/chain/services/denom-exchange/denom-exchange.service.spec.ts`

- [ ] **Step 1: Add the three new test cases**

Add these tests inside the `describe("getExchangeRateToUSD")` block, after the existing tests and before the closing `});` of that describe block:

```typescript
    it("falls back to DB price when oracle reports unhealthy", async () => {
      const { service, dayRepository, logger } = setup({ isHealthy: false, latestAktPrice: 1.23 });

      const result = await service.getExchangeRateToUSD("akt");

      expect(dayRepository.getLatestAktPrice).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ORACLE_PRICE_UNHEALTHY" }));
      expect(result).toEqual({
        price: 1.23,
        volume: 0,
        marketCap: 0,
        marketCapRank: 0,
        priceChange24h: 0,
        priceChangePercentage24: 0
      });
    });

    it("falls back to DB price when oracle RPC fails", async () => {
      const { service, dayRepository, logger } = setup({ oracleThrows: true, latestAktPrice: 0.99 });

      const result = await service.getExchangeRateToUSD("akt");

      expect(dayRepository.getLatestAktPrice).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ORACLE_RPC_FAILED" }));
      expect(result).toEqual({
        price: 0.99,
        volume: 0,
        marketCap: 0,
        marketCapRank: 0,
        priceChange24h: 0,
        priceChangePercentage24: 0
      });
    });

    it("returns zero price when oracle fails and DB has no price", async () => {
      const { service, logger } = setup({ oracleThrows: true, latestAktPrice: null });

      const result = await service.getExchangeRateToUSD("akt");

      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ORACLE_RPC_FAILED" }));
      expect(result).toEqual({
        price: 0,
        volume: 0,
        marketCap: 0,
        marketCapRank: 0,
        priceChange24h: 0,
        priceChangePercentage24: 0
      });
    });
```

- [ ] **Step 2: Run all tests to verify they pass**

Run: `cd apps/api && npx vitest run src/chain/services/denom-exchange/denom-exchange.service.spec.ts`

Expected: All 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/chain/services/denom-exchange/denom-exchange.service.spec.ts
git commit -m "test(api): add unit tests for oracle DB fallback scenarios"
```

---

### Task 5: Verify lint and type check

**Files:** None (validation only)

- [ ] **Step 1: Run linter**

Run: `cd apps/api && npm run lint -- --quiet`

Expected: No errors.

- [ ] **Step 2: Run type check**

Run: `cd apps/api && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Run full test suite**

Run: `cd apps/api && npm run test:unit`

Expected: All tests pass (no regressions).
