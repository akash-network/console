import { container } from "tsyringe";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { ProviderEarningsService } from "./provider-earnings.service";

import { createAkashAddress, createAkashBlock, createProvider } from "@test/seeders";

describe(ProviderEarningsService.name, () => {
  const firstTwoDays = { from: new Date("2026-01-01"), to: new Date("2026-01-02") };
  const firstThreeDays = { from: new Date("2026-01-01"), to: new Date("2026-01-03") };

  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();

    await Promise.all(
      [1, 2, 3].map(day =>
        createAkashBlock({
          height: day * 100,
          datetime: new Date(`2026-01-0${day}T12:00:00Z`),
          isProcessed: true,
          totalUUsdSpent: 1000
        })
      )
    );
  });

  describe("getProviderEarnings", () => {
    it("answers a repeated range for the same provider without computing it again", async () => {
      const { service, computeEarnings } = setup();
      const provider = await createProvider();

      const first = await service.getProviderEarnings(provider.owner, firstTwoDays);
      const second = await service.getProviderEarnings(provider.owner, firstTwoDays);

      expect(second).toEqual(first);
      expect(computeEarnings).toHaveBeenCalledTimes(1);
    });

    it("computes each range on its own", async () => {
      const { service, computeEarnings } = setup();
      const provider = await createProvider();

      await service.getProviderEarnings(provider.owner, firstTwoDays);
      await service.getProviderEarnings(provider.owner, firstThreeDays);

      expect(computeEarnings).toHaveBeenCalledTimes(2);
      expect(computeEarnings).toHaveBeenLastCalledWith(provider.owner, 100, 300);
    });

    it("computes each provider on its own", async () => {
      const { service, computeEarnings } = setup();
      const [provider, otherProvider] = await Promise.all([createProvider(), createProvider()]);

      await service.getProviderEarnings(provider.owner, firstTwoDays);
      await service.getProviderEarnings(otherProvider.owner, firstTwoDays);

      expect(computeEarnings).toHaveBeenCalledTimes(2);
      expect(computeEarnings).toHaveBeenLastCalledWith(otherProvider.owner, 100, 200);
    });

    it("finds a provider indexed after an earlier lookup missed it", async () => {
      const { service } = setup();
      const owner = createAkashAddress();

      await expect(service.getProviderEarnings(owner, firstTwoDays)).rejects.toThrow("Provider not found");
      await createProvider({ owner });

      await expect(service.getProviderEarnings(owner, firstTwoDays)).resolves.toHaveProperty("earnings");
    });
  });

  function setup() {
    const service = new ProviderEarningsService(container.resolve(CHAIN_DB));
    const computeEarnings = vi.spyOn(service, "getEarningsAtHeight");

    return { service, computeEarnings };
  }
});
