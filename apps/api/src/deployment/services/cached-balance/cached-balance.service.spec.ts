import type { Mocked } from "vitest";
import { vi } from "vitest";

import type { BalancesService } from "@src/billing/services/balances/balances.service";
import { CachedBalanceService } from "./cached-balance.service";

import { createAkashAddress } from "@test/seeders";

describe(CachedBalanceService.name, () => {
  describe("get", () => {
    const address = createAkashAddress();
    const DEPLOYMENT_LIMIT = 1000;

    it("should fetch and cache balance for new address", async () => {
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

    it("should use cached balance for existing address", async () => {
      const { service, balancesService } = setup();
      balancesService.getFreshLimits.mockResolvedValue({
        deployment: DEPLOYMENT_LIMIT,
        fee: 100
      });

      await service.get(address);
      await service.get(address);

      expect(balancesService.getFreshLimits).toHaveBeenCalledTimes(1);
    });

    it("should throw error when trying to reserve more than available", async () => {
      const { service, balancesService } = setup();
      balancesService.getFreshLimits.mockResolvedValue({
        deployment: DEPLOYMENT_LIMIT,
        fee: 100
      });

      const balance = await service.get(address);

      balance.reserveSufficientAmount(1000);

      expect(() => balance.reserveSufficientAmount(200)).toThrow("Insufficient balance");
    });

    it("should return maximum available amount when requesting more than available", async () => {
      const { service, balancesService } = setup();
      balancesService.getFreshLimits.mockResolvedValue({
        deployment: DEPLOYMENT_LIMIT,
        fee: 100
      });

      const balance = await service.get(address);

      const amount = balance.reserveSufficientAmount(1500);
      expect(amount).toBe(1000);
    });

    it("should throw error when trying to reserve zero or negative amount", async () => {
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

  function setup() {
    const balancesService = {
      getFreshLimits: vi.fn()
    } as unknown as Mocked<BalancesService>;

    const service = new CachedBalanceService(balancesService);

    return { service, balancesService };
  }
});
