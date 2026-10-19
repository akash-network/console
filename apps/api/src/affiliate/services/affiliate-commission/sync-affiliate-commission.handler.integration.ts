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
    expect(topUpWallet).toHaveBeenCalledWith(
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
    const { payment, affiliateUser, topUpWallet, syncCommissionOf } = await setup();
    const personalOrganization = await seedOrganization({ type: "personal", createdByUserId: affiliateUser.id });

    await syncCommissionOf(payment.id);

    const commission = await container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id);
    expect(commission).toMatchObject({ userId: affiliateUser.id, organizationId: personalOrganization.id });
    expect(topUpWallet).toHaveBeenCalledWith(500, { userId: affiliateUser.id, organizationId: personalOrganization.id }, expect.anything());
  });

  it("credits a payment another member made for a team the referred user created", async () => {
    const { payer, affiliateUser, topUpWallet, syncCommissionOf } = await setup();
    const team = await seedOrganization({ type: "team", createdByUserId: payer.id });
    const teammate = await seedUser();
    const payment = await createPayment({ userId: teammate.id, organizationId: team.id });

    await syncCommissionOf(payment.id);

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

  it("takes back the commission on the refunded part of a referred user's payment, run the way a worker runs it", async () => {
    const { payment, affiliateUser, reduceWalletBalance, syncCommissionOf } = await setup({ paymentAmount: 10000, paymentAmountRefunded: 4000 });
    const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
    const commission = await stripeTransactionRepository.createAffiliateCommission({ userId: affiliateUser.id, amount: 500, sourceTransactionId: payment.id });

    await syncCommissionOf(payment.id, "refund");

    await expect(stripeTransactionRepository.findById(commission.id)).resolves.toMatchObject({ status: "succeeded", amount: 500, amountRefunded: 200 });
    expect(reduceWalletBalance).toHaveBeenCalledWith(200, { userId: affiliateUser.id, organizationId: null }, { currency: "usd", transactionId: commission.id });
  });

  it("records nothing when a refund sync finds no commission to take back", async () => {
    const { payment, topUpWallet, reduceWalletBalance, syncCommissionOf } = await setup({ paymentAmountRefunded: 4000 });

    await syncCommissionOf(payment.id, "refund");

    await expect(container.resolve(StripeTransactionRepository).findAffiliateCommissionBySource(payment.id)).resolves.toBeUndefined();
    expect(topUpWallet).not.toHaveBeenCalled();
    expect(reduceWalletBalance).not.toHaveBeenCalled();
  });

  it("grants only what is left of the commission when the payment was partly refunded before the settlement sync ran", async () => {
    const { payment, affiliateUser, topUpWallet, reduceWalletBalance, syncCommissionOf } = await setup({ paymentAmount: 10000, paymentAmountRefunded: 4000 });

    await syncCommissionOf(payment.id);

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

    async function syncCommissionOf(transactionId: string, trigger: AffiliateCommissionSyncTrigger = "settlement") {
      await enqueue(new SyncAffiliateCommission({ transactionId, trigger }));
      await startWorkers();
      await expectJobCompleted(SyncAffiliateCommission[JOB_NAME], { data: { transactionId } });
    }

    return { payer, affiliateUser, affiliateWallet, payment, topUpWallet, reduceWalletBalance, syncCommissionOf };
  }

  async function createPayment(input: {
    userId: string;
    organizationId?: string;
    status?: "succeeded" | "pending";
    amount?: number;
    amountRefunded?: number;
  }) {
    return await container.resolve(StripeTransactionRepository).create({
      userId: input.userId,
      organizationId: input.organizationId,
      type: "payment_intent",
      status: input.status ?? "succeeded",
      amount: input.amount ?? 10000,
      amountRefunded: input.amountRefunded ?? 0,
      currency: "usd"
    });
  }
});
