import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { PaymentMethodRepository, StripeTransactionRepository } from "@src/billing/repositories";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { JOB_NAME } from "@src/core";
import { SyncAffiliateCommissionHandler } from "./sync-affiliate-commission.handler";
import { SyncAffiliateCommission } from "./sync-affiliate-commission.job";

import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(SyncAffiliateCommissionHandler)]);

describe(SyncAffiliateCommissionHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records and credits the affiliate's commission on a referred user's payment, run the way a worker runs it", async () => {
    const { payment, affiliateUser, topUpWallet, syncCommissionOf } = await setup({ paymentAmount: 1234 });

    await syncCommissionOf(payment.id);

    const commission = await container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id);
    expect(commission).toMatchObject({
      userId: affiliateUser.id,
      type: "affiliate_commission",
      status: "succeeded",
      amount: 61,
      sourceTransactionId: payment.id
    });
    expect(topUpWallet).toHaveBeenCalledWith(61, affiliateUser.id, {
      endTrial: false,
      liftAbuseLock: false,
      payment: { source: "affiliate_commission", transactionId: commission?.id, currency: "usd" }
    });
  });

  it("records nothing when the payer saved the same card as the affiliate", async () => {
    const { payment, payer, affiliateUser, topUpWallet, syncCommissionOf } = await setup();
    const paymentMethodRepository = container.resolve(PaymentMethodRepository);
    const fingerprint = faker.string.alphanumeric(16);
    await paymentMethodRepository.create({ userId: payer.id, fingerprint, paymentMethodId: `pm_${faker.string.alphanumeric(24)}` });
    await paymentMethodRepository.create({ userId: affiliateUser.id, fingerprint, paymentMethodId: `pm_${faker.string.alphanumeric(24)}` });

    await syncCommissionOf(payment.id);

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toBeUndefined();
    expect(topUpWallet).not.toHaveBeenCalled();
  });

  it("records nothing for a payment that has not settled", async () => {
    const { payment, topUpWallet, syncCommissionOf } = await setup({ paymentStatus: "pending" });

    await syncCommissionOf(payment.id);

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toBeUndefined();
    expect(topUpWallet).not.toHaveBeenCalled();
  });

  async function setup(input: { paymentAmount?: number; paymentStatus?: "succeeded" | "pending" } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
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
      status: input.paymentStatus ?? "succeeded",
      amount: input.paymentAmount ?? 10000,
      currency: "usd"
    });
    const topUpWallet = vi.spyOn(container.resolve(RefillService), "topUpWallet").mockResolvedValue({ walletId: affiliateWallet.id, address });

    async function syncCommissionOf(transactionId: string) {
      await enqueue(new SyncAffiliateCommission({ transactionId }));
      await startWorkers();
      await expectJobCompleted(SyncAffiliateCommission[JOB_NAME], { data: { transactionId } });
    }

    return { payer, affiliateUser, payment, topUpWallet, syncCommissionOf };
  }
});
