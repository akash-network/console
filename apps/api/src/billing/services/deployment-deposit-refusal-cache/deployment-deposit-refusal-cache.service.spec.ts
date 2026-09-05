import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { cacheRegistry } from "@src/caching/cache-registry";
import type { BillingConfigService } from "../billing-config/billing-config.service";
import { DeploymentDepositRefusalCache } from "./deployment-deposit-refusal-cache.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(DeploymentDepositRefusalCache.name, () => {
  describe("find", () => {
    it("returns nothing for a wallet that was never refused", () => {
      const { cache, wallet } = setup();

      expect(cache.find(wallet, 500000)).toBeUndefined();
    });

    it("returns the refusal while the wallet row still shows the refused snapshot and the deposit still exceeds the allowance", () => {
      const { cache, wallet } = setup({ ttlSeconds: 300 });
      cache.remember(wallet, { chainDeploymentAllowance: 400000, reloadScheduled: true });

      const cached = cache.find(wallet, 500000);

      expect(cached).toMatchObject({ chainDeploymentAllowance: 400000, reloadScheduled: true, suppressedAttempts: 1 });
      expect(cached!.retryAfterSeconds).toBeGreaterThan(0);
      expect(cached!.retryAfterSeconds).toBeLessThanOrEqual(300);
    });

    it("drops the refusal once the wallet row shows a different allowance", () => {
      const { cache, wallet } = setup();
      cache.remember(wallet, { chainDeploymentAllowance: 0, reloadScheduled: false });

      expect(cache.find({ ...wallet, deploymentAllowance: wallet.deploymentAllowance + 1 }, 500000)).toBeUndefined();
      expect(cache.find(wallet, 500000)).toBeUndefined();
    });

    it("misses without dropping the refusal when the cached allowance covers a smaller deposit", () => {
      const { cache, wallet } = setup();
      cache.remember(wallet, { chainDeploymentAllowance: 400000, reloadScheduled: false });

      expect(cache.find(wallet, 300000)).toBeUndefined();
      expect(cache.find(wallet, 500000)).toBeDefined();
    });

    it("refuses any deposit when the cached allowance is zero", () => {
      const { cache, wallet } = setup();
      cache.remember(wallet, { chainDeploymentAllowance: 0, reloadScheduled: false });

      expect(cache.find(wallet, 1)).toBeDefined();
    });

    it("counts every attempt answered from the cache", () => {
      const { cache, wallet } = setup();
      cache.remember(wallet, { chainDeploymentAllowance: 0, reloadScheduled: false });

      cache.find(wallet, 500000);
      cache.find(wallet, 500000);

      expect(cache.find(wallet, 500000)?.suppressedAttempts).toBe(3);
    });
  });

  describe("remember", () => {
    it("answers with the full ttl as the retry delay", () => {
      const { cache, wallet } = setup({ ttlSeconds: 300 });

      expect(cache.remember(wallet, { chainDeploymentAllowance: 0, reloadScheduled: false })).toEqual({ retryAfterSeconds: 300 });
    });
  });

  describe("markReloadScheduled", () => {
    it("flags a remembered refusal as having its reload scheduled", () => {
      const { cache, wallet } = setup();
      cache.remember(wallet, { chainDeploymentAllowance: 0, reloadScheduled: false });

      cache.markReloadScheduled(wallet.userId);

      expect(cache.find(wallet, 500000)?.reloadScheduled).toBe(true);
    });

    it("does nothing for a wallet that was never refused", () => {
      const { cache, wallet } = setup();

      cache.markReloadScheduled(wallet.userId);

      expect(cache.find(wallet, 500000)).toBeUndefined();
    });
  });

  it("registers itself so a registry-wide clear empties it", () => {
    const { cache, wallet } = setup();
    cache.remember(wallet, { chainDeploymentAllowance: 0, reloadScheduled: false });

    cacheRegistry.clearAll();

    expect(cacheRegistry.getStats().some(stats => stats.name.startsWith(DeploymentDepositRefusalCache.name))).toBe(true);
    expect(cache.find(wallet, 500000)).toBeUndefined();
  });

  function setup(input?: { ttlSeconds?: number }) {
    const cache = new DeploymentDepositRefusalCache(
      mockConfigService<BillingConfigService>({ DEPLOYMENT_CREATE_REFUSAL_CACHE_TTL_SECONDS: input?.ttlSeconds ?? 300 })
    );
    const wallet = createUserWallet({ userId: faker.string.uuid(), deploymentAllowance: 1000000 });

    return { cache, wallet };
  }
});
