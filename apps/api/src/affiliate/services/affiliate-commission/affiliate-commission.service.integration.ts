import { faker } from "@faker-js/faker";
import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { AffiliateCommissionService } from "./affiliate-commission.service";

import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe(AffiliateCommissionService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("syncCommission", () => {
    it("credits the affiliate once when two syncs of the same payment race", async () => {
      const { service, payment, affiliateUser, topUpWallet } = await setup();

      await Promise.all([service.syncCommission(payment.id), service.syncCommission(payment.id)]);

      const commissions = await container.resolve(StripeTransactionRepository).find({ sourceTransactionId: payment.id });
      expect(commissions).toEqual([expect.objectContaining({ userId: affiliateUser.id, type: "affiliate_commission", amount: 500 })]);
      expect(topUpWallet).toHaveBeenCalledTimes(1);
    });
  });

  async function setup() {
    const payer = await seedUser();
    const { user: affiliateUser, wallet: affiliateWallet, address } = await seedUserWithWallet();
    const affiliate = await container.resolve(AffiliateRepository).create({
      userId: affiliateUser.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
    await container.resolve(ReferralRepository).createIfAbsent({ referredUserId: payer.id, affiliateId: affiliate.id });
    const payment = await container.resolve(StripeTransactionRepository).create({
      userId: payer.id,
      type: "payment_intent",
      status: "succeeded",
      amount: 10000,
      currency: "usd"
    });
    const topUpWallet = vi.spyOn(container.resolve(RefillService), "topUpWallet").mockImplementation(async () => {
      await delay(200);
      return { walletId: affiliateWallet.id, address };
    });

    return { service: container.resolve(AffiliateCommissionService), payment, affiliateUser, topUpWallet };
  }
});
