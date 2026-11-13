import { faker } from "@faker-js/faker";
import { subDays } from "date-fns";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { JOB_NAME } from "@src/core";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { ReverseDeletedPaymentCommissionHandler } from "./reverse-deleted-payment-commission.handler";
import { type DeletedPaymentReversal, ReverseDeletedPaymentCommission } from "./reverse-deleted-payment-commission.job";
import { SyncAffiliateCommissionHandler } from "./sync-affiliate-commission.handler";
import { SyncAffiliateCommission } from "./sync-affiliate-commission.job";

import { seedPaymentCredit } from "@test/seeders/db/payment-credit.seeder";
import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { deleteCompletedJobs, expectJobCompleted, makeJobDue, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(SyncAffiliateCommissionHandler), container.resolve(ReverseDeletedPaymentCommissionHandler)]);

describe(ReverseDeletedPaymentCommissionHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("takes back the commission on the refunded part of a payment whose payer deleted their account, run the way a worker runs it", async () => {
    const { payment, affiliateUser, reduceWalletBalance, creditCommissionOf, deletePayer, reverseCommissionOf } = await setup({ paymentAmount: 10000 });
    const commission = await creditCommissionOf(payment.id);
    await deletePayer();

    await reverseCommissionOf(payment.stripeChargeId, { reason: "refund", amount: 10000, amountRefunded: 4000 });

    await expect(container.resolve(StripeTransactionRepository).findById(commission.id)).resolves.toMatchObject({
      status: "succeeded",
      amount: 500,
      amountRefunded: 200,
      sourceTransactionId: null,
      sourceStripeChargeId: payment.stripeChargeId
    });
    expect(reduceWalletBalance).toHaveBeenCalledExactlyOnceWith(
      200,
      { userId: affiliateUser.id, organizationId: null },
      { currency: "usd", transactionId: commission.id, refundedBefore: 0, refundedAfter: 200 }
    );
  });

  it("takes back the whole commission when the dispute on a deleted payer's payment is lost", async () => {
    const { payment, affiliateUser, reduceWalletBalance, creditCommissionOf, deletePayer, reverseCommissionOf } = await setup({ paymentAmount: 10000 });
    const commission = await creditCommissionOf(payment.id);
    await deletePayer();

    await reverseCommissionOf(payment.stripeChargeId, { reason: "dispute_lost" });

    await expect(container.resolve(StripeTransactionRepository).findById(commission.id)).resolves.toMatchObject({
      status: "refunded",
      amount: 500,
      amountRefunded: 500
    });
    expect(reduceWalletBalance).toHaveBeenCalledExactlyOnceWith(
      500,
      { userId: affiliateUser.id, organizationId: null },
      { currency: "usd", transactionId: commission.id, refundedBefore: 0, refundedAfter: 500 }
    );
  });

  it("takes the same refund back only once when it is delivered twice", async () => {
    const { payment, reduceWalletBalance, creditCommissionOf, deletePayer, reverseCommissionOf } = await setup({ paymentAmount: 10000 });
    const commission = await creditCommissionOf(payment.id);
    await deletePayer();
    await reverseCommissionOf(payment.stripeChargeId, { reason: "refund", amount: 10000, amountRefunded: 4000 });
    await deleteCompletedJobs(ReverseDeletedPaymentCommission[JOB_NAME]);

    await reverseCommissionOf(payment.stripeChargeId, { reason: "refund", amount: 10000, amountRefunded: 4000 });

    await expect(container.resolve(StripeTransactionRepository).findById(commission.id)).resolves.toMatchObject({ status: "succeeded", amountRefunded: 200 });
    expect(reduceWalletBalance).toHaveBeenCalledOnce();
  });

  it("cancels a commission still on hold when its deleted payer's payment is fully refunded", async () => {
    const { payment, reduceWalletBalance, topUpWallet, holdCommissionOf, deletePayer, reverseCommissionOf } = await setup({ paymentAmount: 10000 });
    const commission = await holdCommissionOf(payment.id);
    await deletePayer();

    await reverseCommissionOf(payment.stripeChargeId, { reason: "refund", amount: 10000, amountRefunded: 10000 });

    await expect(container.resolve(StripeTransactionRepository).findById(commission.id)).resolves.toMatchObject({
      status: "canceled",
      amount: 500,
      amountRefunded: 500
    });
    expect(reduceWalletBalance).not.toHaveBeenCalled();
    expect(topUpWallet).not.toHaveBeenCalled();
  });

  it("leaves the commission of a payment that still exists to the payment's own sync", async () => {
    const { payment, reduceWalletBalance, creditCommissionOf, reverseCommissionOf } = await setup({ paymentAmount: 10000 });
    const commission = await creditCommissionOf(payment.id);

    await reverseCommissionOf(payment.stripeChargeId, { reason: "dispute_lost" });

    await expect(container.resolve(StripeTransactionRepository).findById(commission.id)).resolves.toMatchObject({
      status: "succeeded",
      amountRefunded: 0,
      sourceTransactionId: payment.id
    });
    expect(reduceWalletBalance).not.toHaveBeenCalled();
  });

  async function setup(input: { paymentAmount?: number } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
    const payer = await seedUser();
    const { user: affiliateUser, wallet: affiliateWallet, address } = await seedUserWithWallet();
    const affiliate = await container.resolve(AffiliateRepository).create({
      userId: affiliateUser.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
    await container.resolve(ReferralRepository).createIfAbsent({ referredUserId: payer.id, affiliateId: affiliate.id });
    const stripeChargeId = `ch_${faker.string.alphanumeric(24)}`;
    const createdPayment = await stripeTransactionRepository.create({
      userId: payer.id,
      type: "payment_intent",
      status: "succeeded",
      amount: input.paymentAmount ?? 10000,
      currency: "usd",
      stripeChargeId
    });
    await seedPaymentCredit({ transactionId: createdPayment.id, status: "landed" });
    const payment = { ...createdPayment, stripeChargeId };
    const topUpWallet = vi.spyOn(container.resolve(RefillService), "topUpWallet").mockResolvedValue({ walletId: affiliateWallet.id, address });
    const reduceWalletBalance = vi.spyOn(container.resolve(RefillService), "reduceWalletBalance").mockResolvedValue({ shortfallCents: 0 });

    async function holdCommissionOf(transactionId: string) {
      await enqueue(new SyncAffiliateCommission({ transactionId, trigger: "settlement" }));
      await startWorkers();
      await expectJobCompleted(SyncAffiliateCommission[JOB_NAME], { data: { transactionId, trigger: "settlement" } });

      return (await stripeTransactionRepository.findAffiliateCommissionBySource(transactionId))!;
    }

    async function creditCommissionOf(transactionId: string) {
      const held = await holdCommissionOf(transactionId);
      await stripeTransactionRepository.updateById(held.id, { createdAt: subDays(new Date(), 31) });
      const releaseJob = { data: { transactionId, trigger: "release" } };
      await makeJobDue(SyncAffiliateCommission[JOB_NAME], releaseJob);
      await expectJobCompleted(SyncAffiliateCommission[JOB_NAME], releaseJob);

      return (await stripeTransactionRepository.findById(held.id))!;
    }

    async function deletePayer() {
      await container.resolve(UserRepository).deleteById(payer.id);
    }

    async function reverseCommissionOf(chargeId: string, reversal: DeletedPaymentReversal) {
      await enqueue(new ReverseDeletedPaymentCommission({ stripeChargeId: chargeId, reversal }));
      await startWorkers();
      await expectJobCompleted(ReverseDeletedPaymentCommission[JOB_NAME], { data: { stripeChargeId: chargeId } });
    }

    return {
      payer,
      affiliate,
      affiliateUser,
      payment,
      topUpWallet,
      reduceWalletBalance,
      holdCommissionOf,
      creditCommissionOf,
      deletePayer,
      reverseCommissionOf
    };
  }
});
