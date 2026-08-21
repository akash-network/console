import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { LoggerService } from "@src/core";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { CachedBalanceService } from "./cached-balance.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders";

describe(CachedBalanceService.name, () => {
  describe("get", () => {
    const address = createAkashAddress();
    const DEPLOYMENT_LIMIT = 1000;

    it("fetches and caches the balance for a new address", async () => {
      const { service, balancesService } = setup();
      balancesService.getFreshLimits.mockResolvedValue({
        deployment: DEPLOYMENT_LIMIT,
        fee: 100
      });

      const balance = await service.get(address);

      expect(balancesService.getFreshLimits).toHaveBeenCalledWith({ address });
      expect(balance).toBeDefined();

      const reservedAmount = balance.reserveSufficientAmount(500);
      expect(reservedAmount).toBe(500);

      const cachedBalance = await service.get(address);
      expect(balancesService.getFreshLimits).toHaveBeenCalledTimes(1);

      const remainingAmount = cachedBalance.reserveSufficientAmount(600);
      expect(remainingAmount).toBe(500);
    });

    it("uses the cached balance for an existing address", async () => {
      const { service, balancesService } = setup();
      balancesService.getFreshLimits.mockResolvedValue({
        deployment: DEPLOYMENT_LIMIT,
        fee: 100
      });

      await service.get(address);
      await service.get(address);

      expect(balancesService.getFreshLimits).toHaveBeenCalledTimes(1);
    });

    it("throws when trying to reserve more than available", async () => {
      const { service, balancesService } = setup();
      balancesService.getFreshLimits.mockResolvedValue({
        deployment: DEPLOYMENT_LIMIT,
        fee: 100
      });

      const balance = await service.get(address);

      balance.reserveSufficientAmount(1000);

      expect(() => balance.reserveSufficientAmount(200)).toThrow("Insufficient balance");
    });

    it("returns the maximum available amount when requesting more than available", async () => {
      const { service, balancesService } = setup();
      balancesService.getFreshLimits.mockResolvedValue({
        deployment: DEPLOYMENT_LIMIT,
        fee: 100
      });

      const balance = await service.get(address);

      const amount = balance.reserveSufficientAmount(1500);
      expect(amount).toBe(1000);
    });

    it("throws when trying to reserve a zero or negative amount", async () => {
      const { service, balancesService } = setup();
      balancesService.getFreshLimits.mockResolvedValue({
        deployment: DEPLOYMENT_LIMIT,
        fee: 100
      });

      const balance = await service.get(address);

      expect(() => balance.reserveSufficientAmount(0)).toThrow("Insufficient balance");
      expect(() => balance.reserveSufficientAmount(-100)).toThrow("Insufficient balance");
    });
  });

  describe("getFresh", () => {
    const address = createAkashAddress();

    it("fetches a fresh, independent balance on every call, bypassing the memo used by get", async () => {
      const { service, balancesService } = setup();
      balancesService.getFreshLimits.mockResolvedValue({ deployment: 1000, fee: 100 });

      const first = await service.getFresh(address);
      const second = await service.getFresh(address);

      expect(balancesService.getFreshLimits).toHaveBeenCalledTimes(2);
      expect(first).not.toBe(second);
      expect(first.reserveSufficientAmount(700)).toBe(700);
      expect(second.reserveSufficientAmount(1000)).toBe(1000);
    });
  });

  describe("balance headroom", () => {
    const address = createAkashAddress();

    it("keeps the headroom out of the spendable amount", async () => {
      const { service, balancesService } = setup({ headroomInUsd: 5 });
      balancesService.getFreshLimits.mockResolvedValue({ deployment: 200_000_000, fee: 100 });

      const balance = await service.getFresh(address);

      expect(balance.available).toBe(200_000_000);
      expect(balance.spendable).toBe(195_000_000);
      expect(balance.headroomWaived).toBe(false);
    });

    it("keeps the headroom across a whole batch of reservations", async () => {
      const { service, balancesService } = setup({ headroomInUsd: 5 });
      balancesService.getFreshLimits.mockResolvedValue({ deployment: 10_000_000, fee: 100 });

      const balance = await service.getFresh(address);
      const first = balance.reserveSufficientAmount(4_000_000);
      const second = balance.reserveSufficientAmount(4_000_000);

      expect(first + second).toBe(5_000_000);
      expect(() => balance.reserveSufficientAmount(1)).toThrow("Insufficient balance");
    });

    it("waives the headroom when the balance is at or below it so running deployments still get funded", async () => {
      const { service, balancesService } = setup({ headroomInUsd: 5 });
      balancesService.getFreshLimits.mockResolvedValue({ deployment: 4_000_000, fee: 100 });

      const balance = await service.getFresh(address);

      expect(balance.spendable).toBe(4_000_000);
      expect(balance.headroomWaived).toBe(true);
      expect(balance.reserveSufficientAmount(10_000_000)).toBe(4_000_000);
    });

    it("spends the full balance when the headroom is disabled", async () => {
      const { service, balancesService } = setup({ headroomInUsd: 0 });
      balancesService.getFreshLimits.mockResolvedValue({ deployment: 200_000_000, fee: 100 });

      const balance = await service.getFresh(address);

      expect(balance.spendable).toBe(200_000_000);
      expect(balance.headroomWaived).toBe(false);
    });

    it("logs the headroom decision so the floor can be tuned from data", async () => {
      const { service, balancesService, logger } = setup({ headroomInUsd: 5 });
      balancesService.getFreshLimits.mockResolvedValue({ deployment: 6_000_000, fee: 100 });

      await service.getFresh(address);

      expect(logger.info).toHaveBeenCalledWith({
        event: "AUTO_TOP_UP_BALANCE_HEADROOM",
        address,
        available: 6_000_000,
        headroom: 5_000_000,
        spendable: 1_000_000,
        waived: false
      });
    });
  });

  function setup(input?: { headroomInUsd?: number }) {
    const balancesService = mock<BalancesService>();
    const deploymentConfig = mockConfigService<DeploymentConfigService>({
      AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD: input?.headroomInUsd ?? 0
    });
    const logger = mock<LoggerService>();

    const service = new CachedBalanceService(balancesService, deploymentConfig, logger);

    return { service, balancesService, deploymentConfig, logger };
  }
});
