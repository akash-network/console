import { faker } from "@faker-js/faker";
import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { JOB_NAME } from "@src/core";
import { AffiliateCommissionService } from "./affiliate-commission.service";
import { SyncAffiliateCommissionHandler } from "./sync-affiliate-commission.handler";
import { SyncAffiliateCommission } from "./sync-affiliate-commission.job";

import { seedPaymentCredit } from "@test/seeders/db/payment-credit.seeder";
import { seedPersonalOrganizationIdOf, seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(SyncAffiliateCommissionHandler)]);

describe(AffiliateCommissionService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("syncCommission", () => {
    it("holds the commission and schedules its release once when two settlement syncs of the same payment race", async () => {
      const { service, payment, affiliateUser, topUpWallet } = await setup();
      const referralRepository = container.resolve(ReferralRepository);
      const findReferral = referralRepository.findWithAffiliateByReferredUserId.bind(referralRepository);
      vi.spyOn(referralRepository, "findWithAffiliateByReferredUserId").mockImplementation(async referredUserId => {
        await delay(200);
        return findReferral(referredUserId);
      });

      await Promise.all([service.syncCommission(payment.id, "settlement"), service.syncCommission(payment.id, "settlement")]);

      const commissions = await container.resolve(StripeTransactionRepository).find({ sourceTransactionId: payment.id });
      expect(commissions).toEqual([expect.objectContaining({ userId: affiliateUser.id, type: "affiliate_commission", status: "pending", amount: 500 })]);
      await expect(findJobRows(SyncAffiliateCommission[JOB_NAME], { data: { transactionId: payment.id, trigger: "release" } })).resolves.toHaveLength(1);
      expect(topUpWallet).not.toHaveBeenCalled();
    });

    it("credits the affiliate once when two releases of the same commission race", async () => {
      const { service, payment, affiliateUser, topUpWallet } = await setup();
      await service.syncCommission(payment.id, "settlement");

      await Promise.all([service.syncCommission(payment.id, "release"), service.syncCommission(payment.id, "release")]);

      const commissions = await container.resolve(StripeTransactionRepository).find({ sourceTransactionId: payment.id });
      expect(commissions).toEqual([expect.objectContaining({ userId: affiliateUser.id, status: "succeeded", amount: 500, amountRefunded: 0 })]);
      expect(topUpWallet).toHaveBeenCalledTimes(1);
    });
  });

  async function setup() {
    await jobWorkers();
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
      organizationId: await seedPersonalOrganizationIdOf(payer.id),
      type: "payment_intent",
      status: "succeeded",
      amount: 10000,
      currency: "usd"
    });
    await seedPaymentCredit({ transactionId: payment.id });
    const topUpWallet = vi.spyOn(container.resolve(RefillService), "topUpWallet").mockImplementation(async () => {
      await delay(200);
      return { walletId: affiliateWallet.id, address };
    });

    return { service: container.resolve(AffiliateCommissionService), payment, affiliateUser, topUpWallet };
  }
});
