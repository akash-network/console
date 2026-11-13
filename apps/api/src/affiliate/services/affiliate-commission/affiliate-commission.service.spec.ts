import type { CreateLogger } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import { addSeconds, subSeconds } from "date-fns";
import { PostgresError } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateOutput, AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import type { ReferralOutput, ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import type { BillingConfig } from "@src/billing/providers";
import type { PaymentMethodRepository, StripeTransactionOutput, StripeTransactionRepository, UserWalletRepository } from "@src/billing/repositories";
import type { PaymentCreditOutput, PaymentCreditRepository } from "@src/billing/repositories/payment-credit/payment-credit.repository";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { AffiliateCommissionService } from "./affiliate-commission.service";
import { SyncAffiliateCommission } from "./sync-affiliate-commission.job";

import { createAffiliate } from "@test/seeders/affiliate.seeder";
import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createOrganization } from "@test/seeders/organization.seeder";
import { createPaymentCredit } from "@test/seeders/payment-credit.seeder";
import { createReferral } from "@test/seeders/referral.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const HOLD_SECONDS = 30 * 24 * 60 * 60;

describe(AffiliateCommissionService.name, () => {
  describe("syncCommission", () => {
    it("holds 5% of a referred user's card payment for the affiliate's personal organization and schedules its release", async () => {
      const {
        service,
        payment,
        affiliate,
        affiliatePersonalOrganization,
        commission,
        stripeTransactionRepository,
        jobQueueService,
        refillService,
        analyticsService,
        logger
      } = setup({ paymentAmount: 10000 });
      const releasesAt = addSeconds(commission.createdAt, HOLD_SECONDS);

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalledWith({
        userId: affiliate.userId,
        organizationId: affiliatePersonalOrganization.id,
        amount: 500,
        amountRefunded: 0,
        sourceTransactionId: payment.id
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new SyncAffiliateCommission({ transactionId: payment.id, trigger: "release" }), {
        startAfter: releasesAt
      });
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(analyticsService.track).toHaveBeenCalledWith(affiliate.userId, "affiliate_commission_held", {
        amount_cents: 500,
        source_transaction_id: payment.id,
        referred_user_id: payment.userId,
        releases_at: releasesAt.toISOString()
      });
      expect(logger.info).toHaveBeenCalledWith({
        event: "AFFILIATE_COMMISSION_HELD",
        commissionId: commission.id,
        affiliateUserId: affiliate.userId,
        sourceTransactionId: payment.id,
        amountCents: 500,
        grossAmountCents: 500,
        releasesAt
      });
    });

    it("schedules the release as long after the commission as the configured hold", async () => {
      const { service, payment, commission, jobQueueService } = setup({ holdSeconds: 120 });

      await service.syncCommission(payment.id, "settlement");

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.anything(), { startAfter: addSeconds(commission.createdAt, 120) });
    });

    it("records the commission before scheduling its release", async () => {
      const { service, payment, stripeTransactionRepository, jobQueueService } = setup();

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.createAffiliateCommission.mock.invocationCallOrder[0]).toBeLessThan(
        jobQueueService.enqueue.mock.invocationCallOrder[0]
      );
    });

    it("holds the payment row lock for the whole sync so concurrent syncs of the same payment serialize", async () => {
      const { service, payment, txService, stripeTransactionRepository, jobQueueService } = setup();
      const ranInsideTransaction: Record<string, boolean> = {};
      let insideTransaction = false;
      txService.transaction.mockImplementation(async cb => {
        insideTransaction = true;
        try {
          return await cb();
        } finally {
          insideTransaction = false;
        }
      });
      stripeTransactionRepository.findOneByAndLock.mockImplementation(async () => {
        ranInsideTransaction.lockPayment = insideTransaction;
        return payment;
      });
      jobQueueService.enqueue.mockImplementation(async () => {
        ranInsideTransaction.scheduleRelease = insideTransaction;
        return "job-id";
      });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.findOneByAndLock).toHaveBeenCalledWith({ id: payment.id });
      expect(ranInsideTransaction).toEqual({ lockPayment: true, scheduleRelease: true });
    });

    it.each([
      { paymentAmount: 1234, commissionAmount: 61 },
      { paymentAmount: 10000, commissionAmount: 500 },
      { paymentAmount: 39, commissionAmount: 1 },
      { paymentAmount: 20, commissionAmount: 1 }
    ])("rounds a $paymentAmount cent payment down to a $commissionAmount cent commission", async ({ paymentAmount, commissionAmount }) => {
      const { service, payment, stripeTransactionRepository } = setup({ paymentAmount });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalledWith(
        expect.objectContaining({ amount: commissionAmount, amountRefunded: 0 })
      );
    });

    it("holds nothing when 5% of the payment rounds down to zero cents", async () => {
      const { service, payment, stripeTransactionRepository, jobQueueService, logger } = setup({ paymentAmount: 19 });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "below_one_cent" });
    });

    it("checks the affiliate program flag for the affiliate who would be credited", async () => {
      const { service, payment, affiliate, featureFlagsService } = setup();

      await service.syncCommission(payment.id, "settlement");

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.AFFILIATE_PROGRAM, { userId: affiliate.userId });
    });

    it.each([
      { reason: "program_disabled", input: { isProgramEnabled: false } },
      { reason: "affiliate_revoked", input: { affiliateRevokedAt: new Date().toISOString() } },
      { reason: "affiliate_abuse_locked", input: { affiliateAbuseLockedAt: new Date() } },
      { reason: "shared_payment_method", input: { sharesPaymentMethod: true } },
      { reason: "credit_not_landed", input: { paymentCreditStatus: "pending" as const } },
      { reason: "credit_not_landed", input: { hasPaymentCredit: false } }
    ])("holds nothing when the payment is skipped as $reason", async ({ reason, input }) => {
      const { service, payment, stripeTransactionRepository, jobQueueService, logger } = setup(input);

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason });
    });

    it("looks up the credit of the payment it holds commission for", async () => {
      const { service, payment, paymentCreditRepository } = setup();

      await service.syncCommission(payment.id, "settlement");

      expect(paymentCreditRepository.findByTransactionId).toHaveBeenCalledWith(payment.id);
    });

    it("skips a payment whose credit has not landed without locking it", async () => {
      const { service, payment, stripeTransactionRepository } = setup({ paymentCreditStatus: "pending" });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.findOneByAndLock).not.toHaveBeenCalled();
    });

    it.each(["release", "refund", "dispute"] as const)("does not look up the payment's credit on a %s sync", async trigger => {
      const { service, payment, paymentCreditRepository, stripeTransactionRepository } = setup({ paymentCreditStatus: "pending" });

      await service.syncCommission(payment.id, trigger);

      expect(paymentCreditRepository.findByTransactionId).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.findOneByAndLock).toHaveBeenCalledWith({ id: payment.id });
    });

    it("holds nothing for a payer who was not referred", async () => {
      const { service, payment, referralRepository, stripeTransactionRepository, jobQueueService, analyticsService, logger } = setup({ isReferred: false });

      await service.syncCommission(payment.id, "settlement");

      expect(referralRepository.findWithAffiliateByReferredUserId).toHaveBeenCalledWith(payment.userId);
      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "not_referred" });
    });

    it("holds a payment made exactly 12 months after the referral", async () => {
      const { service, payment, stripeTransactionRepository } = setup({
        referredAt: "2025-01-15T10:00:00.000Z",
        paymentCreatedAt: new Date("2026-01-15T10:00:00.000Z")
      });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalled();
    });

    it("holds nothing for a payment made more than 12 months after the referral", async () => {
      const { service, payment, stripeTransactionRepository, logger } = setup({
        referredAt: "2025-01-15T10:00:00.000Z",
        paymentCreatedAt: new Date("2026-01-16T10:00:00.000Z")
      });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({
        event: "AFFILIATE_COMMISSION_SKIPPED",
        transactionId: payment.id,
        reason: "commission_window_ended"
      });
    });

    it("compares the payer's cards with the affiliate's", async () => {
      const { service, payment, affiliate, paymentMethodRepository } = setup();

      await service.syncCommission(payment.id, "settlement");

      expect(paymentMethodRepository.hasSharedFingerprint).toHaveBeenCalledWith({ userId: payment.userId, organizationId: null }, affiliate.userId);
    });

    it("checks the abuse lock of the affiliate's own wallet", async () => {
      const { service, payment, affiliate, userWalletRepository } = setup();

      await service.syncCommission(payment.id, "settlement");

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(affiliate.userId);
    });

    it("holds the commission of a payment by a team the referred user created, whichever member paid", async () => {
      const referredUserId = faker.string.uuid();
      const team = createOrganization({ type: "team", createdByUserId: referredUserId });
      const { service, payment, affiliate, referralRepository, paymentMethodRepository, stripeTransactionRepository, analyticsService } = setup({
        paymentOrganization: team
      });

      await service.syncCommission(payment.id, "settlement");

      expect(referralRepository.findWithAffiliateByReferredUserId).toHaveBeenCalledWith(referredUserId);
      expect(paymentMethodRepository.hasSharedFingerprint).toHaveBeenCalledWith({ userId: referredUserId, organizationId: team.id }, affiliate.userId);
      expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalledWith(expect.objectContaining({ userId: affiliate.userId, amount: 500 }));
      expect(analyticsService.track).toHaveBeenCalledWith(
        affiliate.userId,
        "affiliate_commission_held",
        expect.objectContaining({ referred_user_id: referredUserId })
      );
    });

    it("counts a personal organization's payment for the user it belongs to", async () => {
      const owner = faker.string.uuid();
      const personal = createOrganization({ type: "personal", createdByUserId: owner });
      const { service, payment, referralRepository, organizationRepository } = setup({ paymentOrganization: personal });

      await service.syncCommission(payment.id, "settlement");

      expect(organizationRepository.findById).toHaveBeenCalledWith(personal.id);
      expect(referralRepository.findWithAffiliateByReferredUserId).toHaveBeenCalledWith(owner);
    });

    it.each([
      { case: "whose creator deleted their account", paymentOrganization: createOrganization({ type: "team", createdByUserId: null }) },
      { case: "that no longer exists", paymentOrganization: createOrganization({ type: "team" }), isOrganizationGone: true }
    ])("holds nothing for a payment by an organization $case", async ({ paymentOrganization, isOrganizationGone }) => {
      const { service, payment, referralRepository, stripeTransactionRepository, logger } = setup({ paymentOrganization, isOrganizationGone });

      await service.syncCommission(payment.id, "settlement");

      expect(referralRepository.findWithAffiliateByReferredUserId).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "not_referred" });
    });

    it("records the commission with no organization for an affiliate who has no personal organization yet", async () => {
      const { service, payment, stripeTransactionRepository } = setup({ affiliateHasPersonalOrganization: false });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalledWith(expect.objectContaining({ organizationId: null }));
    });

    it("holds the commission of an affiliate who has no wallet yet", async () => {
      const { service, payment, stripeTransactionRepository } = setup({ affiliateHasWallet: false });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalled();
    });

    it("does nothing when the payment already has its commission", async () => {
      const { service, payment, stripeTransactionRepository, referralRepository, jobQueueService, refillService } = setup({ hasCommission: true });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.findAffiliateCommissionBySourceAndLock).toHaveBeenCalledWith(payment.id);
      expect(referralRepository.findWithAffiliateByReferredUserId).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("holds only what is left of the commission of a payment partly refunded before its first sync", async () => {
      const { service, payment, affiliate, affiliatePersonalOrganization, stripeTransactionRepository, analyticsService } = setup({
        paymentAmount: 10000,
        paymentAmountRefunded: 4000
      });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalledWith({
        userId: affiliate.userId,
        organizationId: affiliatePersonalOrganization.id,
        amount: 500,
        amountRefunded: 200,
        sourceTransactionId: payment.id
      });
      expect(analyticsService.track).toHaveBeenCalledWith(affiliate.userId, "affiliate_commission_held", expect.objectContaining({ amount_cents: 300 }));
    });

    it("holds nothing for a payment fully refunded before its first sync", async () => {
      const { service, payment, stripeTransactionRepository, logger } = setup({
        paymentStatus: "refunded",
        paymentAmount: 10000,
        paymentAmountRefunded: 10000
      });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "nothing_left_to_grant" });
    });

    it("holds nothing for a payment lost to a dispute before its first sync", async () => {
      const { service, payment, stripeTransactionRepository, logger } = setup({ paymentDisputeLostAt: new Date() });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "nothing_left_to_grant" });
    });

    it.each(["release", "refund", "dispute"] as const)("records nothing when a %s sync finds no commission", async trigger => {
      const { service, payment, referralRepository, stripeTransactionRepository, refillService } = setup({ paymentAmountRefunded: 4000 });

      await service.syncCommission(payment.id, trigger);

      expect(referralRepository.findWithAffiliateByReferredUserId).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it.each(["created", "pending", "requires_action", "failed", "canceled"] as const)("does nothing for a %s payment", async paymentStatus => {
      const { service, payment, stripeTransactionRepository } = setup({ paymentStatus });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.findAffiliateCommissionBySourceAndLock).not.toHaveBeenCalled();
    });

    it.each(["coupon_claim", "manual_credit", "affiliate_commission"] as const)("does nothing for a %s transaction", async paymentType => {
      const { service, payment, stripeTransactionRepository } = setup({ paymentType });

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.findAffiliateCommissionBySourceAndLock).not.toHaveBeenCalled();
    });

    it("does nothing when the payment no longer exists", async () => {
      const { service, stripeTransactionRepository } = setup();
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(undefined);

      await service.syncCommission("missing-transaction-id", "release");

      expect(stripeTransactionRepository.findAffiliateCommissionBySourceAndLock).not.toHaveBeenCalled();
    });

    it("treats a commission that another sync recorded first as already held", async () => {
      const { service, payment, stripeTransactionRepository, jobQueueService, analyticsService, logger } = setup();
      stripeTransactionRepository.createAffiliateCommission.mockRejectedValue(createUniqueViolation("stripe_transactions_source_transaction_id_unique"));

      await expect(service.syncCommission(payment.id, "settlement")).resolves.toBeUndefined();

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_ALREADY_GRANTED", transactionId: payment.id });
    });

    it("rethrows any other failure to record the commission so the job retries", async () => {
      const { service, payment, stripeTransactionRepository, jobQueueService } = setup();
      const error = new Error("connection terminated");
      stripeTransactionRepository.createAffiliateCommission.mockRejectedValue(error);

      await expect(service.syncCommission(payment.id, "settlement")).rejects.toBe(error);

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("rethrows a failure to schedule the release so the job retries without reporting a hold", async () => {
      const { service, payment, jobQueueService, analyticsService } = setup();
      const error = new Error("queue unavailable");
      jobQueueService.enqueue.mockRejectedValue(error);

      await expect(service.syncCommission(payment.id, "settlement")).rejects.toBe(error);

      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    describe("when the hold ends", () => {
      it("credits the held commission to the affiliate and marks it succeeded", async () => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService, analyticsService, logger } = setup({
          hasCommission: true,
          commissionStatus: "pending"
        });

        await service.syncCommission(payment.id, "release");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { status: "succeeded", amountRefunded: 0 });
        expect(refillService.topUpWallet).toHaveBeenCalledWith(
          500,
          { userId: affiliate.userId, organizationId: commission.organizationId },
          {
            endTrial: false,
            liftAbuseLock: false,
            payment: { source: "affiliate_commission", transactionId: commission.id, currency: "usd" }
          }
        );
        expect(analyticsService.track).toHaveBeenCalledWith(affiliate.userId, "affiliate_commission_released", {
          amount_cents: 500,
          source_transaction_id: payment.id,
          referred_user_id: payment.userId
        });
        expect(logger.info).toHaveBeenCalledWith({
          event: "AFFILIATE_COMMISSION_RELEASED",
          commissionId: commission.id,
          affiliateUserId: affiliate.userId,
          sourceTransactionId: payment.id,
          amountCents: 500
        });
      });

      it("marks the commission succeeded before crediting it", async () => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({ hasCommission: true, commissionStatus: "pending" });

        await service.syncCommission(payment.id, "release");

        expect(stripeTransactionRepository.updateById.mock.invocationCallOrder[0]).toBeLessThan(refillService.topUpWallet.mock.invocationCallOrder[0]);
      });

      it("credits only what the hold kept after a partial refund", async () => {
        const { service, payment, commission, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          paymentAmount: 10000,
          paymentAmountRefunded: 4000,
          commissionAmountRefunded: 200
        });

        await service.syncCommission(payment.id, "release");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { status: "succeeded", amountRefunded: 200 });
        expect(refillService.topUpWallet).toHaveBeenCalledWith(300, expect.anything(), expect.anything());
      });

      it("credits no more than the payer's share still paid when a refund landed after the hold last saw the payment", async () => {
        const { service, payment, commission, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          paymentAmount: 10000,
          paymentAmountRefunded: 6000
        });

        await service.syncCommission(payment.id, "release");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { status: "succeeded", amountRefunded: 300 });
        expect(refillService.topUpWallet).toHaveBeenCalledWith(200, expect.anything(), expect.anything());
      });

      it("never credits more than the hold was already trimmed to", async () => {
        const { service, payment, commission, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          commissionAmountRefunded: 200
        });

        await service.syncCommission(payment.id, "release");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { status: "succeeded", amountRefunded: 200 });
        expect(refillService.topUpWallet).toHaveBeenCalledWith(300, expect.anything(), expect.anything());
      });

      it("checks the affiliate program flag for the affiliate who holds the commission", async () => {
        const { service, payment, affiliate, featureFlagsService } = setup({ hasCommission: true, commissionStatus: "pending" });

        await service.syncCommission(payment.id, "release");

        expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.AFFILIATE_PROGRAM, { userId: affiliate.userId });
      });

      it("reports only what the hold still kept when it cancels a trimmed commission", async () => {
        const { service, payment, affiliate, analyticsService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          commissionAmountRefunded: 200,
          isProgramEnabled: false
        });

        await service.syncCommission(payment.id, "release");

        expect(analyticsService.track).toHaveBeenCalledWith(affiliate.userId, "affiliate_commission_canceled", expect.objectContaining({ amount_cents: 300 }));
      });

      it("looks up the affiliate who holds the commission", async () => {
        const { service, payment, affiliate, affiliateRepository } = setup({ hasCommission: true, commissionStatus: "pending" });

        await service.syncCommission(payment.id, "release");

        expect(affiliateRepository.findOneBy).toHaveBeenCalledWith({ userId: affiliate.userId });
      });

      it.each([
        { reason: "program_disabled", input: { isProgramEnabled: false } },
        { reason: "affiliate_revoked", input: { affiliateRevokedAt: new Date().toISOString() } },
        { reason: "affiliate_revoked", input: { isAffiliateGone: true } },
        { reason: "affiliate_abuse_locked", input: { affiliateAbuseLockedAt: new Date() } },
        { reason: "nothing_left_to_grant", input: { paymentAmountRefunded: 10000 } }
      ])("cancels the held commission instead of crediting it as $reason", async ({ reason, input }) => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService, analyticsService, logger } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          ...input
        });

        await service.syncCommission(payment.id, "release");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledExactlyOnceWith(commission.id, { status: "canceled", amountRefunded: 500 });
        expect(refillService.topUpWallet).not.toHaveBeenCalled();
        expect(analyticsService.track).toHaveBeenCalledWith(affiliate.userId, "affiliate_commission_canceled", {
          amount_cents: 500,
          source_transaction_id: payment.id,
          reason
        });
        expect(logger.info).toHaveBeenCalledWith({
          event: "AFFILIATE_COMMISSION_CANCELED",
          commissionId: commission.id,
          sourceTransactionId: payment.id,
          reason
        });
      });

      it("leaves a held commission whose affiliate account is gone untouched", async () => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          isAffiliateAccountGone: true
        });

        await service.syncCommission(payment.id, "release");

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.topUpWallet).not.toHaveBeenCalled();
      });

      it.each(["succeeded", "canceled"] as const)("credits nothing again for a commission already %s", async commissionStatus => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({ hasCommission: true, commissionStatus });

        await service.syncCommission(payment.id, "release");

        expect(refillService.topUpWallet).not.toHaveBeenCalled();
        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      });

      it("rethrows a failed top-up so the job retries without reporting a release", async () => {
        const { service, payment, refillService, analyticsService } = setup({ hasCommission: true, commissionStatus: "pending" });
        const error = new Error("signer unavailable");
        refillService.topUpWallet.mockRejectedValue(error);

        await expect(service.syncCommission(payment.id, "release")).rejects.toBe(error);

        expect(analyticsService.track).not.toHaveBeenCalled();
      });
    });

    describe("when the referred payment is refunded or lost to a dispute during the hold", () => {
      it("shrinks the held commission to the payer's share still paid without touching any wallet", async () => {
        const { service, payment, commission, stripeTransactionRepository, refillService, analyticsService, logger } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          paymentAmount: 10000,
          paymentAmountRefunded: 4000
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledExactlyOnceWith(commission.id, { amountRefunded: 200 });
        expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
        expect(refillService.topUpWallet).not.toHaveBeenCalled();
        expect(analyticsService.track).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith({
          event: "AFFILIATE_COMMISSION_HOLD_REDUCED",
          commissionId: commission.id,
          sourceTransactionId: payment.id,
          amountCents: 300,
          reason: "refund"
        });
      });

      it("keeps a held commission trimmed below the payer's share still paid as it is", async () => {
        const { service, payment, stripeTransactionRepository } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          paymentAmount: 10000,
          paymentAmountRefunded: 1000,
          commissionAmountRefunded: 200
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      });

      it("leaves the held commission as it is when a later sync finds the refund already applied", async () => {
        const { service, payment, stripeTransactionRepository } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          paymentAmount: 10000,
          paymentAmountRefunded: 4000,
          commissionAmountRefunded: 200
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      });

      it.each([
        { reason: "refund", trigger: "refund" as const, input: { paymentAmountRefunded: 10000 } },
        { reason: "dispute_lost", trigger: "dispute" as const, input: { paymentDisputeLostAt: new Date() } }
      ])("cancels the held commission on a full $reason without touching any wallet", async ({ reason, trigger, input }) => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService, analyticsService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          paymentAmount: 10000,
          ...input
        });

        await service.syncCommission(payment.id, trigger);

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledExactlyOnceWith(commission.id, { status: "canceled", amountRefunded: 500 });
        expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
        expect(analyticsService.track).toHaveBeenCalledWith(affiliate.userId, "affiliate_commission_canceled", expect.objectContaining({ reason }));
      });

      it("cancels the held commission of an affiliate account that is gone without reporting it", async () => {
        const { service, payment, commission, stripeTransactionRepository, analyticsService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          isAffiliateAccountGone: true,
          paymentAmountRefunded: 10000
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { status: "canceled", amountRefunded: 500 });
        expect(analyticsService.track).not.toHaveBeenCalled();
      });
    });

    describe("when the referred payment is disputed during the hold", () => {
      it.each([
        { state: "is still open", input: { paymentDisputeOpenedAt: new Date("2026-03-01T00:00:00Z") } },
        {
          state: "was opened after an earlier one closed",
          input: { paymentDisputeOpenedAt: new Date("2026-03-01T00:00:00Z"), paymentDisputeClosedAt: new Date("2026-02-01T00:00:00Z") }
        }
      ])("leaves the commission held when the hold ends while a dispute $state", async ({ input }) => {
        const { service, payment, commission, stripeTransactionRepository, refillService, analyticsService, logger } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          ...input
        });

        await service.syncCommission(payment.id, "release");

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.topUpWallet).not.toHaveBeenCalled();
        expect(analyticsService.track).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith({
          event: "AFFILIATE_COMMISSION_RELEASE_DEFERRED",
          commissionId: commission.id,
          sourceTransactionId: payment.id,
          reason: "dispute_open"
        });
      });

      it("credits the held commission when the hold ends after the dispute closed in Console's favour", async () => {
        const { service, payment, commission, stripeTransactionRepository, refillService, logger } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          paymentDisputeOpenedAt: new Date("2026-02-01T00:00:00Z"),
          paymentDisputeClosedAt: new Date("2026-03-01T00:00:00Z")
        });

        await service.syncCommission(payment.id, "release");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledExactlyOnceWith(commission.id, { status: "succeeded", amountRefunded: 0 });
        expect(refillService.topUpWallet).toHaveBeenCalledWith(500, expect.anything(), expect.anything());
        expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_COMMISSION_RELEASE_DEFERRED" }));
      });

      it("credits the held commission as soon as a dispute closes in Console's favour once the hold is over", async () => {
        const { service, payment, commission, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          commissionCreatedAt: subSeconds(new Date(), HOLD_SECONDS + 60),
          paymentDisputeOpenedAt: new Date("2026-02-01T00:00:00Z"),
          paymentDisputeClosedAt: new Date("2026-03-01T00:00:00Z")
        });

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledExactlyOnceWith(commission.id, { status: "succeeded", amountRefunded: 0 });
        expect(refillService.topUpWallet).toHaveBeenCalledWith(500, expect.anything(), expect.anything());
      });

      it("keeps the commission held when a dispute closes in Console's favour before the hold is over", async () => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          commissionCreatedAt: subSeconds(new Date(), HOLD_SECONDS - 60),
          paymentDisputeOpenedAt: new Date("2026-02-01T00:00:00Z"),
          paymentDisputeClosedAt: new Date("2026-03-01T00:00:00Z")
        });

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.topUpWallet).not.toHaveBeenCalled();
      });

      it("keeps the commission held when a dispute closes while a later one is open, even once the hold is over", async () => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          commissionCreatedAt: subSeconds(new Date(), HOLD_SECONDS + 60),
          paymentDisputeOpenedAt: new Date("2026-03-01T00:00:00Z"),
          paymentDisputeClosedAt: new Date("2026-02-01T00:00:00Z")
        });

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.topUpWallet).not.toHaveBeenCalled();
      });

      it("cancels a commission still held past its hold when the dispute is lost", async () => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService, analyticsService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          commissionCreatedAt: subSeconds(new Date(), HOLD_SECONDS + 60),
          paymentDisputeOpenedAt: new Date("2026-02-01T00:00:00Z"),
          paymentDisputeClosedAt: new Date("2026-03-01T00:00:00Z"),
          paymentDisputeLostAt: new Date("2026-03-01T00:00:00Z")
        });

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledExactlyOnceWith(commission.id, { status: "canceled", amountRefunded: 500 });
        expect(refillService.topUpWallet).not.toHaveBeenCalled();
        expect(analyticsService.track).toHaveBeenCalledWith(
          affiliate.userId,
          "affiliate_commission_canceled",
          expect.objectContaining({ reason: "dispute_lost" })
        );
      });

      it("credits nothing on a refund of a commission still held past its hold", async () => {
        const { service, payment, commission, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          commissionCreatedAt: subSeconds(new Date(), HOLD_SECONDS + 60),
          paymentAmount: 10000,
          paymentAmountRefunded: 4000
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledExactlyOnceWith(commission.id, { amountRefunded: 200 });
        expect(refillService.topUpWallet).not.toHaveBeenCalled();
      });
    });

    describe("when the referred payment is refunded or lost to a dispute after the release", () => {
      it("takes back 200 of a 500 cent commission when 40% of a $100 payment is refunded", async () => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService, analyticsService, logger } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentAmountRefunded: 4000,
          commissionAmount: 500
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { amountRefunded: 200 });
        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(
          200,
          { userId: affiliate.userId, organizationId: commission.organizationId },
          {
            currency: "usd",
            transactionId: commission.id,
            refundedBefore: 0,
            refundedAfter: 200
          }
        );
        expect(analyticsService.track).toHaveBeenCalledWith(affiliate.userId, "affiliate_commission_reversed", {
          amount_cents: 200,
          source_transaction_id: payment.id,
          referred_user_id: payment.userId,
          reason: "refund"
        });
        expect(logger.info).toHaveBeenCalledWith({
          event: "AFFILIATE_COMMISSION_REVERSED",
          commissionId: commission.id,
          affiliateUserId: affiliate.userId,
          sourceTransactionId: payment.id,
          amountCents: 200,
          totalReversedCents: 200,
          shortfallCents: 0,
          reason: "refund"
        });
      });

      it("takes back the rest of the commission and marks it refunded once the payment is fully refunded", async () => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          paymentStatus: "refunded",
          paymentAmount: 10000,
          paymentAmountRefunded: 10000,
          commissionAmount: 500,
          commissionAmountRefunded: 200
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { amountRefunded: 500, status: "refunded" });
        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(300, expect.objectContaining({ userId: affiliate.userId }), {
          currency: "usd",
          transactionId: commission.id,
          refundedBefore: 200,
          refundedAfter: 500
        });
      });

      it("takes back nothing more when a later sync finds the refund already reversed", async () => {
        const { service, payment, stripeTransactionRepository, refillService, analyticsService } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentAmountRefunded: 4000,
          commissionAmount: 500,
          commissionAmountRefunded: 200
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
        expect(analyticsService.track).not.toHaveBeenCalled();
      });

      it("takes nothing back from a commission whose affiliate account is gone", async () => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          isAffiliateAccountGone: true,
          paymentAmount: 10000,
          paymentAmountRefunded: 4000
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
      });

      it("names the team's creator as the referred user when a team payment's commission is taken back", async () => {
        const referredUserId = faker.string.uuid();
        const { service, payment, affiliate, analyticsService } = setup({
          hasCommission: true,
          paymentOrganization: createOrganization({ type: "team", createdByUserId: referredUserId }),
          paymentAmount: 10000,
          paymentAmountRefunded: 4000
        });

        await service.syncCommission(payment.id, "refund");

        expect(analyticsService.track).toHaveBeenCalledWith(
          affiliate.userId,
          "affiliate_commission_reversed",
          expect.objectContaining({ referred_user_id: referredUserId })
        );
      });

      it("never gives back commission it already took back", async () => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentAmountRefunded: 0,
          commissionAmount: 500,
          commissionAmountRefunded: 200
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
      });

      it.each([
        { paymentAmountRefunded: 0, expectedUpdates: [] },
        { paymentAmountRefunded: 1, expectedUpdates: [{ amountRefunded: 1 }] },
        { paymentAmountRefunded: 34, expectedUpdates: [{ amountRefunded: 2 }] },
        { paymentAmountRefunded: 1000, expectedUpdates: [{ amountRefunded: 50 }] }
      ])(
        "keeps a 61 cent commission on a 1234 cent payment at its share of what is left after a $paymentAmountRefunded cent refund, rounded down",
        async ({ paymentAmountRefunded, expectedUpdates }) => {
          const { service, payment, stripeTransactionRepository } = setup({
            hasCommission: true,
            paymentAmount: 1234,
            paymentAmountRefunded,
            commissionAmount: 61
          });

          await service.syncCommission(payment.id, "refund");

          expect(stripeTransactionRepository.updateById.mock.calls.map(([, update]) => update)).toEqual(expectedUpdates);
        }
      );

      it("takes back in proportion to the stored commission, whatever rate it was granted at", async () => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentAmountRefunded: 5000,
          commissionAmount: 1000
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { amountRefunded: 500 });
        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(500, expect.objectContaining({ userId: affiliate.userId }), expect.anything());
      });

      it("never takes back more than the commission", async () => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentAmountRefunded: 12000,
          commissionAmount: 500
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { amountRefunded: 500, status: "refunded" });
        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(500, expect.objectContaining({ userId: affiliate.userId }), expect.anything());
      });

      it("takes back the whole commission when the payer lost a dispute", async () => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService, analyticsService, logger } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentDisputeLostAt: new Date(),
          commissionAmount: 500
        });

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { amountRefunded: 500, status: "refunded" });
        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(500, expect.objectContaining({ userId: affiliate.userId }), {
          currency: "usd",
          transactionId: commission.id,
          refundedBefore: 0,
          refundedAfter: 500
        });
        expect(analyticsService.track).toHaveBeenCalledWith(
          affiliate.userId,
          "affiliate_commission_reversed",
          expect.objectContaining({ reason: "dispute_lost" })
        );
        expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_COMMISSION_REVERSED", reason: "dispute_lost" }));
      });

      it("takes back the rest of a partly refunded payment's commission when the payer then lost a dispute", async () => {
        const { service, payment, affiliate, commission, refillService } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentAmountRefunded: 4000,
          paymentDisputeLostAt: new Date(),
          commissionAmount: 500,
          commissionAmountRefunded: 200
        });

        await service.syncCommission(payment.id, "dispute");

        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(300, expect.objectContaining({ userId: affiliate.userId }), {
          currency: "usd",
          transactionId: commission.id,
          refundedBefore: 200,
          refundedAfter: 500
        });
      });

      it("still takes back the commission of an affiliate who was revoked since", async () => {
        const { service, payment, affiliate, refillService } = setup({
          hasCommission: true,
          affiliateRevokedAt: new Date().toISOString(),
          paymentAmount: 10000,
          paymentAmountRefunded: 10000,
          commissionAmount: 500
        });

        await service.syncCommission(payment.id, "refund");

        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(500, expect.objectContaining({ userId: affiliate.userId }), expect.anything());
      });

      it("still takes back the commission while the affiliate program flag is off", async () => {
        const { service, payment, affiliate, refillService, featureFlagsService } = setup({
          hasCommission: true,
          isProgramEnabled: false,
          paymentAmount: 10000,
          paymentAmountRefunded: 10000,
          commissionAmount: 500
        });

        await service.syncCommission(payment.id, "refund");

        expect(featureFlagsService.isEnabled).not.toHaveBeenCalled();
        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(500, expect.objectContaining({ userId: affiliate.userId }), expect.anything());
      });

      it("records the reversal before reducing the affiliate's wallet", async () => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          paymentAmountRefunded: 4000
        });

        await service.syncCommission(payment.id, "refund");

        expect(stripeTransactionRepository.updateById.mock.invocationCallOrder[0]).toBeLessThan(refillService.reduceWalletBalance.mock.invocationCallOrder[0]);
      });

      it("logs the part of the reversal the affiliate's balance could no longer cover", async () => {
        const { service, payment, logger } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentAmountRefunded: 10000,
          commissionAmount: 500,
          shortfallCents: 120
        });

        await service.syncCommission(payment.id, "refund");

        expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_COMMISSION_REVERSED", amountCents: 500, shortfallCents: 120 }));
      });

      it("rethrows a failed wallet reduction so the job retries without reporting a reversal", async () => {
        const { service, payment, refillService, analyticsService } = setup({ hasCommission: true, paymentAmountRefunded: 4000 });
        const error = new Error("signer unavailable");
        refillService.reduceWalletBalance.mockRejectedValue(error);

        await expect(service.syncCommission(payment.id, "refund")).rejects.toBe(error);

        expect(analyticsService.track).not.toHaveBeenCalled();
      });
    });

    describe("when the disputed funds of the referred payment are withdrawn", () => {
      const WITHDRAWN_AT = new Date("2026-03-01T00:00:00Z");

      it("takes back the whole credited commission and holds it again until the dispute is decided", async () => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService, analyticsService, logger } = setup({
          hasCommission: true,
          paymentDisputeOpenedAt: new Date("2026-02-28T00:00:00Z"),
          paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT
        });
        const heldCommission = generateDatabaseStripeTransaction({ type: "affiliate_commission", status: "pending" });
        stripeTransactionRepository.createAffiliateCommission.mockResolvedValue(heldCommission);

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledExactlyOnceWith(commission.id, { amountRefunded: 500, status: "refunded" });
        expect(refillService.reduceWalletBalance).toHaveBeenCalledExactlyOnceWith(
          500,
          { userId: affiliate.userId, organizationId: commission.organizationId },
          { currency: "usd", transactionId: commission.id, refundedBefore: 0, refundedAfter: 500 }
        );
        expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalledExactlyOnceWith({
          userId: affiliate.userId,
          organizationId: commission.organizationId,
          amount: 500,
          amountRefunded: 0,
          sourceTransactionId: payment.id,
          createdAt: commission.createdAt
        });
        expect(refillService.topUpWallet).not.toHaveBeenCalled();
        expect(analyticsService.track).toHaveBeenCalledExactlyOnceWith(affiliate.userId, "affiliate_commission_reversed", {
          amount_cents: 500,
          source_transaction_id: payment.id,
          referred_user_id: payment.userId,
          reason: "dispute_funds_withdrawn"
        });
        expect(logger.info).toHaveBeenCalledWith({
          event: "AFFILIATE_COMMISSION_HELD_FOR_DISPUTE",
          commissionId: heldCommission.id,
          reversedCommissionId: commission.id,
          affiliateUserId: affiliate.userId,
          sourceTransactionId: payment.id,
          amountCents: 500
        });
        expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_COMMISSION_REVERSED", reason: "dispute_funds_withdrawn" }));
      });

      it("marks the credited commission taken back before holding it again", async () => {
        const { service, payment, stripeTransactionRepository } = setup({ hasCommission: true, paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT });

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.updateById.mock.invocationCallOrder[0]).toBeLessThan(
          stripeTransactionRepository.createAffiliateCommission.mock.invocationCallOrder[0]
        );
      });

      it("holds again only what the affiliate's balance still covered", async () => {
        const { service, payment, stripeTransactionRepository, logger } = setup({
          hasCommission: true,
          paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT,
          shortfallCents: 120
        });

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ amount: 500, amountRefunded: 120 })
        );
        expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_COMMISSION_HELD_FOR_DISPUTE", amountCents: 380 }));
      });

      it("holds again only the part of a partly refunded payment's commission that was still credited", async () => {
        const { service, payment, commission, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentAmountRefunded: 4000,
          commissionAmount: 500,
          commissionAmountRefunded: 200,
          paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT
        });

        await service.syncCommission(payment.id, "dispute");

        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(300, expect.anything(), {
          currency: "usd",
          transactionId: commission.id,
          refundedBefore: 200,
          refundedAfter: 500
        });
        expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ amount: 500, amountRefunded: 200 })
        );
      });

      it("holds nothing again when the affiliate's balance covered none of what was taken back", async () => {
        const { service, payment, stripeTransactionRepository, logger } = setup({
          hasCommission: true,
          paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT,
          shortfallCents: 500
        });

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
        expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_COMMISSION_HELD_FOR_DISPUTE" }));
        expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_COMMISSION_REVERSED", shortfallCents: 500 }));
      });

      it("takes nothing back again when a later sync finds the commission already taken back", async () => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          commissionStatus: "refunded",
          commissionAmountRefunded: 500,
          paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT
        });

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
        expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      });

      it("keeps the credited commission once the dispute closed in Console's favour after the withdrawal", async () => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT,
          paymentDisputeClosedAt: addSeconds(WITHDRAWN_AT, 60)
        });

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
        expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      });

      it("takes back the credited commission when the funds are withdrawn after an earlier dispute closed", async () => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT,
          paymentDisputeClosedAt: subSeconds(WITHDRAWN_AT, 60)
        });

        await service.syncCommission(payment.id, "dispute");

        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(500, expect.anything(), expect.anything());
        expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalledOnce();
      });

      it("takes the commission back for good, holding nothing again, when the dispute was lost", async () => {
        const { service, payment, stripeTransactionRepository, refillService, logger } = setup({
          hasCommission: true,
          paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT,
          paymentDisputeClosedAt: addSeconds(WITHDRAWN_AT, 60),
          paymentDisputeLostAt: addSeconds(WITHDRAWN_AT, 60)
        });

        await service.syncCommission(payment.id, "dispute");

        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(500, expect.anything(), expect.anything());
        expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_COMMISSION_REVERSED", reason: "dispute_lost" }));
      });

      it.each(["release", "dispute"] as const)("leaves a commission held past its hold as it is on a %s sync", async trigger => {
        const { service, payment, commission, stripeTransactionRepository, refillService, logger } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          commissionCreatedAt: subSeconds(new Date(), HOLD_SECONDS + 60),
          paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT
        });

        await service.syncCommission(payment.id, trigger);

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.topUpWallet).not.toHaveBeenCalled();
        expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith({
          event: "AFFILIATE_COMMISSION_RELEASE_DEFERRED",
          commissionId: commission.id,
          sourceTransactionId: payment.id,
          reason: "dispute_open"
        });
      });

      it("leaves a commission still in its hold as it is", async () => {
        const { service, payment, stripeTransactionRepository, refillService, analyticsService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          commissionCreatedAt: subSeconds(new Date(), HOLD_SECONDS - 60),
          paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT
        });

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
        expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
        expect(analyticsService.track).not.toHaveBeenCalled();
      });

      it("credits the commission held for the dispute as soon as it closes in Console's favour", async () => {
        const { service, payment, commission, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          commissionStatus: "pending",
          commissionAmountRefunded: 120,
          commissionCreatedAt: subSeconds(new Date(), HOLD_SECONDS + 60),
          paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT,
          paymentDisputeClosedAt: addSeconds(WITHDRAWN_AT, 60)
        });

        await service.syncCommission(payment.id, "dispute");

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledExactlyOnceWith(commission.id, { status: "succeeded", amountRefunded: 120 });
        expect(refillService.topUpWallet).toHaveBeenCalledWith(380, expect.anything(), expect.anything());
      });

      it("reports the reversal without reporting a new hold when another sync already recorded it", async () => {
        const { service, payment, stripeTransactionRepository, logger } = setup({ hasCommission: true, paymentDisputeFundsWithdrawnAt: WITHDRAWN_AT });
        stripeTransactionRepository.createAffiliateCommission.mockRejectedValue(createUniqueViolation("stripe_transactions_source_transaction_id_unique"));

        await service.syncCommission(payment.id, "dispute");

        expect(logger.warn).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_ALREADY_GRANTED", transactionId: payment.id });
        expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_COMMISSION_HELD_FOR_DISPUTE" }));
        expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_COMMISSION_REVERSED" }));
      });
    });
  });

  function createUniqueViolation(constraintName: string) {
    const driverError = Object.assign(Object.create(PostgresError.prototype), {
      name: "PostgresError",
      code: "23505",
      constraint_name: constraintName,
      message: `duplicate key value violates unique constraint "${constraintName}"`
    });

    return new Error("Failed query: insert into stripe_transactions", { cause: driverError });
  }

  describe("when a release credit landed but its sync rolled back", () => {
    it.each(["refund", "dispute"] as const)("records the commission as credited and takes back the refunded share on a %s", async trigger => {
      const { service, payment, commission, stripeTransactionRepository, refillService, affiliate } = setup({
        hasCommission: true,
        commissionStatus: "pending",
        commissionAmount: 500,
        paymentAmountRefunded: 10000,
        releaseCredit: { status: "landed", amount: 500 }
      });

      await service.syncCommission(payment.id, trigger);

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { status: "succeeded", amountRefunded: 0 });
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { amountRefunded: 500, status: "refunded" });
      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(
        500,
        { userId: affiliate.userId, organizationId: commission.organizationId },
        { currency: "usd", transactionId: commission.id, refundedBefore: 0, refundedAfter: 500 }
      );
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalledWith(commission.id, expect.objectContaining({ status: "canceled" }));
    });

    it("leaves a commission held for a dispute alone when the landed credit belongs to the commission it replaced", async () => {
      const { service, payment, commission, stripeTransactionRepository, refillService, logger } = setup({
        hasCommission: true,
        commissionStatus: "refunded",
        commissionAmount: 500,
        commissionAmountRefunded: 500,
        paymentDisputeOpenedAt: subSeconds(new Date(), 600),
        paymentDisputeFundsWithdrawnAt: subSeconds(new Date(), 300),
        releaseCredit: { status: "landed", amount: 500 }
      });
      const heldForDispute = generateDatabaseStripeTransaction({
        userId: commission.userId,
        type: "affiliate_commission",
        status: "pending",
        amount: 500,
        amountRefunded: 0,
        sourceTransactionId: payment.id,
        createdAt: commission.createdAt
      });
      stripeTransactionRepository.findAffiliateCommissionBySourceAndLock.mockResolvedValue(heldForDispute);

      await service.syncCommission(payment.id, "dispute");

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_COMMISSION_RELEASE_RECOVERED" }));
    });

    it("keeps the share the release trimmed off as already not credited", async () => {
      const { service, payment, commission, stripeTransactionRepository, refillService } = setup({
        hasCommission: true,
        commissionStatus: "pending",
        commissionAmount: 500,
        commissionAmountRefunded: 200,
        paymentAmountRefunded: 10000,
        releaseCredit: { status: "landed", amount: 300 }
      });

      await service.syncCommission(payment.id, "refund");

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { status: "succeeded", amountRefunded: 200 });
      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(
        300,
        expect.anything(),
        expect.objectContaining({ refundedBefore: 200, refundedAfter: 500 })
      );
    });

    it("records the commission as credited without crediting it again or canceling it when the release retries after a revocation", async () => {
      const { service, payment, commission, stripeTransactionRepository, refillService } = setup({
        hasCommission: true,
        commissionStatus: "pending",
        affiliateRevokedAt: new Date().toISOString(),
        releaseCredit: { status: "landed", amount: 500 }
      });

      await service.syncCommission(payment.id, "release");

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledTimes(1);
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { status: "succeeded", amountRefunded: 0 });
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("takes back the share a refund trimmed off the held row before the release retried", async () => {
      const { service, payment, commission, stripeTransactionRepository, refillService } = setup({
        hasCommission: true,
        commissionStatus: "pending",
        commissionAmount: 500,
        commissionAmountRefunded: 250,
        paymentAmountRefunded: 5000,
        releaseCredit: { status: "landed", amount: 500 }
      });

      await service.syncCommission(payment.id, "release");

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { status: "succeeded", amountRefunded: 0 });
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { amountRefunded: 250 });
      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(
        250,
        expect.anything(),
        expect.objectContaining({ refundedBefore: 0, refundedAfter: 250 })
      );
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it.each(["release", "refund"] as const)(
      "takes back the whole credit from a commission a full refund canceled before its credit was seen, on a %s",
      async trigger => {
        const { service, payment, commission, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          commissionStatus: "canceled",
          commissionAmount: 500,
          commissionAmountRefunded: 500,
          paymentAmountRefunded: 10000,
          releaseCredit: { status: "landed", amount: 500 }
        });

        await service.syncCommission(payment.id, trigger);

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { status: "succeeded", amountRefunded: 0 });
        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { amountRefunded: 500, status: "refunded" });
        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(
          500,
          expect.anything(),
          expect.objectContaining({ refundedBefore: 0, refundedAfter: 500 })
        );
      }
    );

    it("leaves a canceled commission alone when no release credit exists", async () => {
      const { service, payment, stripeTransactionRepository, refillService } = setup({
        hasCommission: true,
        commissionStatus: "canceled",
        commissionAmount: 500,
        commissionAmountRefunded: 500,
        paymentAmountRefunded: 10000
      });

      await service.syncCommission(payment.id, "refund");

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("takes back a refund from an already credited commission the usual way, without recording it as credited again", async () => {
      const { service, payment, commission, stripeTransactionRepository } = setup({
        hasCommission: true,
        commissionStatus: "succeeded",
        commissionAmountRefunded: 100,
        paymentAmountRefunded: 10000,
        releaseCredit: { status: "landed", amount: 400 }
      });

      await service.syncCommission(payment.id, "refund");

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledExactlyOnceWith(commission.id, { amountRefunded: 500, status: "refunded" });
    });

    it("throws so the job retries while the release credit is still in flight", async () => {
      const { service, payment, stripeTransactionRepository, refillService } = setup({
        hasCommission: true,
        commissionStatus: "pending",
        paymentAmountRefunded: 10000,
        releaseCredit: { status: "pending", amount: 500 }
      });

      await expect(service.syncCommission(payment.id, "refund")).rejects.toThrow("still in flight");
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("reads the release credit before taking the payment lock", async () => {
      const { service, payment, stripeTransactionRepository, paymentCreditRepository } = setup({
        hasCommission: true,
        commissionStatus: "pending",
        releaseCredit: { status: "landed", amount: 500 }
      });

      await service.syncCommission(payment.id, "refund");

      expect(paymentCreditRepository.findByTransactionId.mock.invocationCallOrder[0]).toBeLessThan(
        stripeTransactionRepository.findOneByAndLock.mock.invocationCallOrder[0]
      );
    });

    it("does not look for a release credit when settling a payment", async () => {
      const { service, payment, stripeTransactionRepository } = setup();

      await service.syncCommission(payment.id, "settlement");

      expect(stripeTransactionRepository.findAffiliateCommissionBySource).not.toHaveBeenCalled();
    });
  });

  function setup(
    input: {
      paymentAmount?: number;
      paymentAmountRefunded?: number;
      paymentDisputeOpenedAt?: Date;
      paymentDisputeClosedAt?: Date;
      paymentDisputeFundsWithdrawnAt?: Date;
      paymentDisputeLostAt?: Date;
      commissionCreatedAt?: Date;
      paymentStatus?: StripeTransactionOutput["status"];
      paymentType?: StripeTransactionOutput["type"];
      paymentCreatedAt?: Date;
      referredAt?: ReferralOutput["createdAt"];
      affiliateRevokedAt?: AffiliateOutput["revokedAt"];
      affiliateAbuseLockedAt?: Date;
      affiliateHasWallet?: boolean;
      isReferred?: boolean;
      isProgramEnabled?: boolean;
      sharesPaymentMethod?: boolean;
      hasCommission?: boolean;
      paymentOrganization?: OrganizationOutput;
      isOrganizationGone?: boolean;
      affiliateHasPersonalOrganization?: boolean;
      commissionAmount?: number;
      isAffiliateAccountGone?: boolean;
      commissionAmountRefunded?: number;
      commissionStatus?: StripeTransactionOutput["status"];
      isAffiliateGone?: boolean;
      hasPaymentCredit?: boolean;
      paymentCreditStatus?: PaymentCreditOutput["status"];
      releaseCredit?: { status: PaymentCreditOutput["status"]; amount: number };
      holdSeconds?: number;
      shortfallCents?: number;
    } = {}
  ) {
    const affiliate = createAffiliate({ revokedAt: input.affiliateRevokedAt ?? null });
    const affiliatePersonalOrganization = createOrganization({ type: "personal", createdByUserId: affiliate.userId });
    const payment = generateDatabaseStripeTransaction({
      type: input.paymentType ?? "payment_intent",
      status: input.paymentStatus ?? "succeeded",
      amount: input.paymentAmount ?? 10000,
      amountRefunded: input.paymentAmountRefunded ?? 0,
      disputeOpenedAt: input.paymentDisputeOpenedAt ?? null,
      disputeClosedAt: input.paymentDisputeClosedAt ?? null,
      disputeFundsWithdrawnAt: input.paymentDisputeFundsWithdrawnAt ?? null,
      disputeLostAt: input.paymentDisputeLostAt ?? null,
      createdAt: input.paymentCreatedAt ?? new Date(),
      organizationId: input.paymentOrganization?.id ?? null
    });
    const referredUserId = input.paymentOrganization?.createdByUserId ?? payment.userId!;
    const referral = createReferral({ referredUserId, affiliateId: affiliate.id, createdAt: input.referredAt ?? new Date().toISOString() });
    const commission = generateDatabaseStripeTransaction({
      userId: input.isAffiliateAccountGone ? null : affiliate.userId,
      type: "affiliate_commission",
      status: input.commissionStatus ?? "succeeded",
      amount: input.commissionAmount ?? 500,
      amountRefunded: input.commissionAmountRefunded ?? 0,
      sourceTransactionId: payment.id,
      createdAt: input.commissionCreatedAt ?? new Date()
    });
    const affiliateWallet = createUserWallet({ userId: affiliate.userId, abuseLockedAt: input.affiliateAbuseLockedAt ?? null });

    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    stripeTransactionRepository.findOneByAndLock.mockResolvedValue(payment);
    stripeTransactionRepository.findAffiliateCommissionBySourceAndLock.mockResolvedValue(input.hasCommission ? commission : undefined);
    stripeTransactionRepository.createAffiliateCommission.mockImplementation(async created => ({ ...commission, ...created }));

    const referralRepository = mock<ReferralRepository>();
    referralRepository.findWithAffiliateByReferredUserId.mockResolvedValue(input.isReferred === false ? undefined : { referral, affiliate });

    const affiliateRepository = mock<AffiliateRepository>();
    affiliateRepository.findOneBy.mockResolvedValue(input.isAffiliateGone ? undefined : affiliate);

    const paymentCreditRepository = mock<PaymentCreditRepository>();
    const paymentCredit =
      input.hasPaymentCredit === false ? undefined : createPaymentCredit({ transactionId: payment.id, status: input.paymentCreditStatus ?? "landed" });
    const releaseCredit = input.releaseCredit && createPaymentCredit({ transactionId: commission.id, ...input.releaseCredit });
    paymentCreditRepository.findByTransactionId.mockImplementation(async transactionId => (transactionId === commission.id ? releaseCredit : paymentCredit));
    stripeTransactionRepository.findAffiliateCommissionBySource.mockResolvedValue(input.hasCommission ? commission : undefined);

    const paymentMethodRepository = mock<PaymentMethodRepository>();
    paymentMethodRepository.hasSharedFingerprint.mockResolvedValue(input.sharesPaymentMethod ?? false);

    const organizationRepository = mock<OrganizationRepository>();
    organizationRepository.findById.mockResolvedValue(input.isOrganizationGone ? undefined : input.paymentOrganization);
    organizationRepository.findPersonalByUserId.mockResolvedValue(input.affiliateHasPersonalOrganization === false ? undefined : affiliatePersonalOrganization);
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByUserId.mockResolvedValue(input.affiliateHasWallet === false ? undefined : affiliateWallet);

    const refillService = mock<RefillService>();
    refillService.topUpWallet.mockResolvedValue({ walletId: affiliateWallet.id, address: "akash1affiliate" });
    refillService.reduceWalletBalance.mockResolvedValue({ shortfallCents: input.shortfallCents ?? 0 });

    const featureFlagsService = mock<FeatureFlagsService>();
    featureFlagsService.isEnabled.mockReturnValue(input.isProgramEnabled ?? true);

    const analyticsService = mock<AnalyticsService>();

    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());

    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockResolvedValue("job-id");

    const billingConfig = mock<BillingConfig>({ AFFILIATE_COMMISSION_HOLD_SECONDS: input.holdSeconds ?? HOLD_SECONDS });

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new AffiliateCommissionService(
      stripeTransactionRepository,
      referralRepository,
      affiliateRepository,
      paymentMethodRepository,
      paymentCreditRepository,
      organizationRepository,
      userWalletRepository,
      refillService,
      featureFlagsService,
      analyticsService,
      txService,
      jobQueueService,
      billingConfig,
      createLogger
    );

    return {
      service,
      payment,
      affiliate,
      affiliatePersonalOrganization,
      referral,
      commission,
      stripeTransactionRepository,
      referralRepository,
      affiliateRepository,
      paymentMethodRepository,
      paymentCreditRepository,
      organizationRepository,
      userWalletRepository,
      refillService,
      featureFlagsService,
      analyticsService,
      txService,
      jobQueueService,
      logger
    };
  }
});
