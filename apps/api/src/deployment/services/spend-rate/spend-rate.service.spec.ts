import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { LeaseRepository, LivePricePerDeployment } from "@src/deployment/repositories/lease/lease.repository";
import { SpendRateService } from "./spend-rate.service";

import { createInitializedUserWallet } from "@test/seeders/user-wallet.seeder";

describe(SpendRateService.name, () => {
  describe("findByUserId", () => {
    it("answers each deployment's summed live price in the shape a lease reports its price", async () => {
      const { service, wallet } = setup({
        livePrices: [
          { dseq: "100", denom: "uact", price: 1.5 },
          { dseq: "200", denom: "uact", price: 0.25 }
        ]
      });

      const spendRate = await service.findByUserId(wallet.userId);

      expect(spendRate).toEqual([
        { dseq: "100", price: { denom: "uact", amount: "1.500000000000000000" } },
        { dseq: "200", price: { denom: "uact", amount: "0.250000000000000000" } }
      ]);
    });

    it("keeps a deployment priced in two denoms as one entry per denom", async () => {
      const { service, wallet } = setup({
        livePrices: [
          { dseq: "100", denom: "uact", price: 3 },
          { dseq: "100", denom: "uakt", price: 7 }
        ]
      });

      const spendRate = await service.findByUserId(wallet.userId);

      expect(spendRate).toEqual([
        { dseq: "100", price: { denom: "uact", amount: "3.000000000000000000" } },
        { dseq: "100", price: { denom: "uakt", amount: "7.000000000000000000" } }
      ]);
    });

    it("reads the live leases of the user's own wallet", async () => {
      const { service, wallet, walletReaderService, leaseRepository } = setup();

      await service.findByUserId(wallet.userId);

      expect(walletReaderService.getWalletByUserId).toHaveBeenCalledExactlyOnceWith(wallet.userId);
      expect(leaseRepository.sumLivePricesPerDeployment).toHaveBeenCalledExactlyOnceWith(wallet.address);
    });

    it("answers no deployment when nothing is running", async () => {
      const { service, wallet } = setup({ livePrices: [] });

      const spendRate = await service.findByUserId(wallet.userId);

      expect(spendRate).toEqual([]);
    });

    it("refuses a user without a wallet before reading any lease", async () => {
      const { service, wallet, walletReaderService, leaseRepository } = setup();
      walletReaderService.getWalletByUserId.mockRejectedValue(createError(404, "UserWallet Not Found"));

      await expect(service.findByUserId(wallet.userId)).rejects.toMatchObject({ status: 404 });
      expect(leaseRepository.sumLivePricesPerDeployment).not.toHaveBeenCalled();
    });
  });

  function setup(input: { livePrices?: LivePricePerDeployment[] } = {}) {
    const wallet = createInitializedUserWallet();
    const walletReaderService = mock<WalletReaderService>();
    walletReaderService.getWalletByUserId.mockResolvedValue(wallet);
    const leaseRepository = mock<LeaseRepository>();
    leaseRepository.sumLivePricesPerDeployment.mockResolvedValue(input.livePrices ?? []);

    const service = new SpendRateService(walletReaderService, leaseRepository);

    return { service, wallet, walletReaderService, leaseRepository };
  }
});
