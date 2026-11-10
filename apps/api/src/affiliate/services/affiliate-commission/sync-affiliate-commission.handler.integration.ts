import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { PaymentMethodRepository, StripeTransactionRepository, UserWalletRepository } from "@src/billing/repositories";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { JOB_NAME } from "@src/core";
import { SyncAffiliateCommissionHandler } from "./sync-affiliate-commission.handler";
import { type AffiliateCommissionSyncTrigger, SyncAffiliateCommission } from "./sync-affiliate-commission.job";

import { seedOrganization, seedOrganizationMember } from "@test/seeders/db/organization.seeder";
import { seedPaymentCredit } from "@test/seeders/db/payment-credit.seeder";
import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, makeJobDue, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(SyncAffiliateCommissionHandler)]);

describe(SyncAffiliateCommissionHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("holds the affiliate's commission on a referred user's payment and schedules its release, run the way a worker runs it", async () => {
    const { payment, affiliateUser, topUpWallet, syncCommissionOf } = await setup({ paymentAmount: 1234 });

    await syncCommissionOf(payment.id);

    const commission = await container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id);
    expect(commission).toMatchObject({
      userId: affiliateUser.id,
      type: "affiliate_commission",
      status: "pending",
      amount: 61,
      sourceTransactionId: payment.id
    });
    const [releaseJob] = await findJobRows(SyncAffiliateCommission[JOB_NAME], { data: { transactionId: payment.id, trigger: "release" } });
    expect(new Date(releaseJob.start_after).getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    expect(topUpWallet).not.toHaveBeenCalled();
  });

  it("credits the held commission once the hold ends", async () => {
    const { payment, affiliateUser, topUpWallet, syncCommissionOf, releaseCommissionOf } = await setup({ paymentAmount: 1234 });
    await syncCommissionOf(payment.id);

    await releaseCommissionOf(payment.id);

    const commission = await container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id);
    expect(commission).toMatchObject({ status: "succeeded", amount: 61, amountRefunded: 0 });
    expect(topUpWallet).toHaveBeenCalledExactlyOnceWith(
      61,
      { userId: affiliateUser.id, organizationId: null },
      {
        endTrial: false,
        liftAbuseLock: false,
        payment: { source: "affiliate_commission", transactionId: commission?.id, currency: "usd" }
      }
    );
  });

  it("files the commission under the affiliate's personal organization", async () => {
    const { payment, affiliateUser, topUpWallet, syncCommissionOf, releaseCommissionOf } = await setup();
    const personalOrganization = await seedOrganization({ type: "personal", createdByUserId: affiliateUser.id });

    await syncCommissionOf(payment.id);
    await releaseCommissionOf(payment.id);

    const commission = await container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id);
    expect(commission).toMatchObject({ userId: affiliateUser.id, organizationId: personalOrganization.id });
    expect(topUpWallet).toHaveBeenCalledWith(500, { userId: affiliateUser.id, organizationId: personalOrganization.id }, expect.anything());
  });

  it("credits a payment another member made for a team the referred user created", async () => {
    const { payer, affiliateUser, topUpWallet, syncCommissionOf, releaseCommissionOf } = await setup();
    const team = await seedOrganization({ type: "team", createdByUserId: payer.id });
    const teammate = await seedUser();
    const payment = await createPayment({ userId: teammate.id, organizationId: team.id });

    await syncCommissionOf(payment.id);
    await releaseCommissionOf(payment.id);

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toMatchObject({
      userId: affiliateUser.id,
      amount: 500
    });
    expect(topUpWallet).toHaveBeenCalledWith(500, expect.objectContaining({ userId: affiliateUser.id }), expect.anything());
  });

  it("records nothing for a payment by a team the referred user only joined", async () => {
    const { payer, topUpWallet, syncCommissionOf } = await setup();
    const team = await seedOrganization({ type: "team", createdByUserId: (await seedUser()).id });
    await seedOrganizationMember({ organizationId: team.id, userId: payer.id });
    const payment = await createPayment({ userId: payer.id, organizationId: team.id });

    await syncCommissionOf(payment.id);

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toBeUndefined();
    expect(topUpWallet).not.toHaveBeenCalled();
  });

  it("records nothing when the payer's card is saved in a team the affiliate belongs to", async () => {
    const { payment, payer, affiliateUser, topUpWallet, syncCommissionOf } = await setup();
    const affiliateTeam = await seedOrganization({ type: "team" });
    await seedOrganizationMember({ organizationId: affiliateTeam.id, userId: affiliateUser.id });
    const fingerprint = faker.string.alphanumeric(16);
    const paymentMethodRepository = container.resolve(PaymentMethodRepository);
    await paymentMethodRepository.create({ userId: payer.id, fingerprint, paymentMethodId: `pm_${faker.string.alphanumeric(24)}` });
    await paymentMethodRepository.create({
      userId: (await seedUser()).id,
      organizationId: affiliateTeam.id,
      fingerprint,
      paymentMethodId: `pm_${faker.string.alphanumeric(24)}`
    });

    await syncCommissionOf(payment.id);

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toBeUndefined();
    expect(topUpWallet).not.toHaveBeenCalled();
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

  it("records nothing for an affiliate whose wallet is locked for abuse", async () => {
    const { payment, affiliateWallet, topUpWallet, syncCommissionOf } = await setup();
    await container.resolve(UserWalletRepository).lockForAbuse(affiliateWallet.id, "trial_abuse");

    await syncCommissionOf(payment.id);

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toBeUndefined();
    expect(topUpWallet).not.toHaveBeenCalled();
  });

  it("records nothing until the referred user's payment has been credited", async () => {
    const { payer, topUpWallet, syncCommissionOf } = await setup();
    const payment = await createPayment({ userId: payer.id, creditStatus: "pending" });

    await syncCommissionOf(payment.id);

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toBeUndefined();
    await expect(findJobRows(SyncAffiliateCommission[JOB_NAME], { data: { transactionId: payment.id, trigger: "release" } })).resolves.toEqual([]);
    expect(topUpWallet).not.toHaveBeenCalled();
  });

  it("cancels the held commission when the affiliate is revoked before the hold ends", async () => {
    const { payment, affiliate, topUpWallet, syncCommissionOf, releaseCommissionOf } = await setup();
    await syncCommissionOf(payment.id);
    await container.resolve(AffiliateRepository).revokeIfActive(affiliate.id, { revokedAt: new Date(), revokedBy: "ops@akash.network" });

    await releaseCommissionOf(payment.id);

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toMatchObject({
      status: "canceled",
      amount: 500,
      amountRefunded: 500
    });
    expect(topUpWallet).not.toHaveBeenCalled();
  });

  it("shrinks the held commission without touching the affiliate's balance when the payment is partly refunded during the hold", async () => {
    const { payment, reduceWalletBalance, syncCommissionOf, releaseCommissionOf, topUpWallet } = await setup();
    await syncCommissionOf(payment.id);
    await container.resolve(StripeTransactionRepository).updateById(payment.id, { amountRefunded: 4000 });

    await syncCommissionOf(payment.id, "refund");

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toMatchObject({
      status: "pending",
      amountRefunded: 200
    });
    expect(reduceWalletBalance).not.toHaveBeenCalled();

    await releaseCommissionOf(payment.id);

    expect(topUpWallet).toHaveBeenCalledExactlyOnceWith(300, expect.anything(), expect.anything());
  });

  it("takes back a refund from a held commission whose release credit landed before its sync rolled back", async () => {
    const { payment, affiliateUser, reduceWalletBalance, topUpWallet, syncCommissionOf, releaseCommissionOf } = await setup();
    const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
    await syncCommissionOf(payment.id);
    const held = await stripeTransactionRepository.findAffiliateCommissionBySource(payment.id);
    await seedPaymentCredit({ transactionId: held!.id, status: "landed", amount: 500, bonusAmount: 0 });
    await stripeTransactionRepository.updateById(payment.id, { amountRefunded: 10000 });

    await syncCommissionOf(payment.id, "refund");

    await expect(stripeTransactionRepository.findById(held!.id)).resolves.toMatchObject({ status: "refunded", amount: 500, amountRefunded: 500 });
    expect(reduceWalletBalance).toHaveBeenCalledWith(
      500,
      { userId: affiliateUser.id, organizationId: null },
      { currency: "usd", transactionId: held!.id, refundedBefore: 0, refundedAfter: 500 }
    );

    await releaseCommissionOf(payment.id);

    expect(topUpWallet).not.toHaveBeenCalled();
  });

  it("takes back the commission on the refunded part of a referred user's payment after its release, run the way a worker runs it", async () => {
    const { payment, affiliateUser, reduceWalletBalance, syncCommissionOf } = await setup({ paymentAmount: 10000, paymentAmountRefunded: 4000 });
    const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
    const { id } = await stripeTransactionRepository.createAffiliateCommission({ userId: affiliateUser.id, amount: 500, sourceTransactionId: payment.id });
    const commission = await stripeTransactionRepository.updateById(id, { status: "succeeded" }, { returning: true });

    await syncCommissionOf(payment.id, "refund");

    await expect(stripeTransactionRepository.findById(commission.id)).resolves.toMatchObject({ status: "succeeded", amount: 500, amountRefunded: 200 });
    expect(reduceWalletBalance).toHaveBeenCalledWith(
      200,
      { userId: affiliateUser.id, organizationId: null },
      { currency: "usd", transactionId: commission.id, refundedBefore: 0, refundedAfter: 200 }
    );
  });

  it("records nothing when a refund sync finds no commission to take back", async () => {
    const { payment, topUpWallet, reduceWalletBalance, syncCommissionOf } = await setup({ paymentAmountRefunded: 4000 });

    await syncCommissionOf(payment.id, "refund");

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toBeUndefined();
    expect(topUpWallet).not.toHaveBeenCalled();
    expect(reduceWalletBalance).not.toHaveBeenCalled();
  });

  it("credits only what is left of the commission when the payment was partly refunded before the settlement sync ran", async () => {
    const { payment, affiliateUser, topUpWallet, reduceWalletBalance, syncCommissionOf, releaseCommissionOf } = await setup({
      paymentAmount: 10000,
      paymentAmountRefunded: 4000
    });

    await syncCommissionOf(payment.id);
    await releaseCommissionOf(payment.id);

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toMatchObject({
      userId: affiliateUser.id,
      status: "succeeded",
      amount: 500,
      amountRefunded: 200
    });
    expect(topUpWallet).toHaveBeenCalledExactlyOnceWith(300, { userId: affiliateUser.id, organizationId: null }, expect.anything());
    expect(reduceWalletBalance).not.toHaveBeenCalled();
  });

  it("records nothing for a payment that has not settled", async () => {
    const { payment, topUpWallet, syncCommissionOf } = await setup({ paymentStatus: "pending" });

    await syncCommissionOf(payment.id);

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toBeUndefined();
    expect(topUpWallet).not.toHaveBeenCalled();
  });

  async function setup(input: { paymentAmount?: number; paymentAmountRefunded?: number; paymentStatus?: "succeeded" | "pending" } = {}) {
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
    const payment = await createPayment({
      userId: payer.id,
      status: input.paymentStatus,
      amount: input.paymentAmount,
      amountRefunded: input.paymentAmountRefunded
    });
    const topUpWallet = vi.spyOn(container.resolve(RefillService), "topUpWallet").mockResolvedValue({ walletId: affiliateWallet.id, address });
    const reduceWalletBalance = vi.spyOn(container.resolve(RefillService), "reduceWalletBalance").mockResolvedValue({ shortfallCents: 0 });

    async function syncCommissionOf(transactionId: string, trigger: Exclude<AffiliateCommissionSyncTrigger, "release"> = "settlement") {
      await enqueue(new SyncAffiliateCommission({ transactionId, trigger }));
      await startWorkers();
      await expectJobCompleted(SyncAffiliateCommission[JOB_NAME], { data: { transactionId, trigger } });
    }

    async function releaseCommissionOf(transactionId: string) {
      const releaseJob = { data: { transactionId, trigger: "release" } };
      await makeJobDue(SyncAffiliateCommission[JOB_NAME], releaseJob);
      await startWorkers();
      await expectJobCompleted(SyncAffiliateCommission[JOB_NAME], releaseJob);
    }

    return { payer, affiliate, affiliateUser, affiliateWallet, payment, topUpWallet, reduceWalletBalance, syncCommissionOf, releaseCommissionOf };
  }

  async function createPayment(input: {
    userId: string;
    organizationId?: string;
    status?: "succeeded" | "pending";
    amount?: number;
    amountRefunded?: number;
    creditStatus?: "landed" | "pending";
  }) {
    const payment = await container.resolve(StripeTransactionRepository).create({
      userId: input.userId,
      organizationId: input.organizationId,
      type: "payment_intent",
      status: input.status ?? "succeeded",
      amount: input.amount ?? 10000,
      amountRefunded: input.amountRefunded ?? 0,
      currency: "usd"
    });
    await seedPaymentCredit({ transactionId: payment.id, status: input.creditStatus ?? "landed" });

    return payment;
  }
});
