import type { CreateLogger } from "@akashnetwork/logging";
import { PostgresError } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateOutput } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import type { ReferralOutput, ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import type { PaymentMethodRepository, StripeTransactionOutput, StripeTransactionRepository, UserWalletRepository } from "@src/billing/repositories";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import { AffiliateCommissionService } from "./affiliate-commission.service";

import { createAffiliate } from "@test/seeders/affiliate.seeder";
import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createReferral } from "@test/seeders/referral.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(AffiliateCommissionService.name, () => {
  describe("syncCommission", () => {
    it("credits the affiliate 5% of a referred user's card payment", async () => {
      const { service, payment, affiliate, commission, stripeTransactionRepository, refillService, analyticsService, logger } = setup({
        paymentAmount: 10000
      });

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalledWith({
        userId: affiliate.userId,
        amount: 500,
        sourceTransactionId: payment.id
      });
      expect(refillService.topUpWallet).toHaveBeenCalledWith(500, affiliate.userId, {
        endTrial: false,
        liftAbuseLock: false,
        payment: { source: "affiliate_commission", transactionId: commission.id, currency: "usd" }
      });
      expect(analyticsService.track).toHaveBeenCalledWith(affiliate.userId, "affiliate_commission_granted", {
        amount_cents: 500,
        source_transaction_id: payment.id,
        referred_user_id: payment.userId
      });
      expect(logger.info).toHaveBeenCalledWith({
        event: "AFFILIATE_COMMISSION_GRANTED",
        commissionId: commission.id,
        affiliateUserId: affiliate.userId,
        sourceTransactionId: payment.id,
        amountCents: 500
      });
    });

    it("records the commission before crediting the affiliate's wallet", async () => {
      const { service, payment, stripeTransactionRepository, refillService } = setup();

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.createAffiliateCommission.mock.invocationCallOrder[0]).toBeLessThan(
        refillService.topUpWallet.mock.invocationCallOrder[0]
      );
    });

    it("holds the payment row lock for the whole sync so concurrent syncs of the same payment serialize", async () => {
      const { service, payment, txService, stripeTransactionRepository, refillService } = setup();
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
      refillService.topUpWallet.mockImplementation(async () => {
        ranInsideTransaction.topUpWallet = insideTransaction;
        return { walletId: 1, address: "akash1affiliate" };
      });

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.findOneByAndLock).toHaveBeenCalledWith({ id: payment.id });
      expect(ranInsideTransaction).toEqual({ lockPayment: true, topUpWallet: true });
    });

    it.each([
      { paymentAmount: 1234, commissionAmount: 61 },
      { paymentAmount: 10000, commissionAmount: 500 },
      { paymentAmount: 39, commissionAmount: 1 },
      { paymentAmount: 20, commissionAmount: 1 }
    ])("rounds a $paymentAmount cent payment down to a $commissionAmount cent commission", async ({ paymentAmount, commissionAmount }) => {
      const { service, payment, affiliate, refillService } = setup({ paymentAmount });

      await service.syncCommission(payment.id);

      expect(refillService.topUpWallet).toHaveBeenCalledWith(commissionAmount, affiliate.userId, expect.anything());
    });

    it("grants nothing when 5% of the payment rounds down to zero cents", async () => {
      const { service, payment, stripeTransactionRepository, refillService, logger } = setup({ paymentAmount: 19 });

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "below_one_cent" });
    });

    it("checks the affiliate program flag for the affiliate who would be credited", async () => {
      const { service, payment, affiliate, featureFlagsService } = setup();

      await service.syncCommission(payment.id);

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.AFFILIATE_PROGRAM, { userId: affiliate.userId });
    });

    it("grants nothing while the affiliate program flag is off", async () => {
      const { service, payment, stripeTransactionRepository, refillService, logger } = setup({ isProgramEnabled: false });

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "program_disabled" });
    });

    it("grants nothing for a payer who was not referred", async () => {
      const { service, payment, referralRepository, stripeTransactionRepository, refillService, analyticsService, logger } = setup({ isReferred: false });

      await service.syncCommission(payment.id);

      expect(referralRepository.findWithAffiliateByReferredUserId).toHaveBeenCalledWith(payment.userId);
      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "not_referred" });
    });

    it("grants nothing once the affiliate has been revoked", async () => {
      const { service, payment, stripeTransactionRepository, refillService, logger } = setup({ affiliateRevokedAt: new Date().toISOString() });

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "affiliate_revoked" });
    });

    it("grants a payment made exactly 12 months after the referral", async () => {
      const { service, payment, refillService } = setup({
        referredAt: "2025-01-15T10:00:00.000Z",
        paymentCreatedAt: new Date("2026-01-15T10:00:00.000Z")
      });

      await service.syncCommission(payment.id);

      expect(refillService.topUpWallet).toHaveBeenCalled();
    });

    it("grants nothing for a payment made more than 12 months after the referral", async () => {
      const { service, payment, stripeTransactionRepository, refillService, logger } = setup({
        referredAt: "2025-01-15T10:00:00.000Z",
        paymentCreatedAt: new Date("2026-01-16T10:00:00.000Z")
      });

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({
        event: "AFFILIATE_COMMISSION_SKIPPED",
        transactionId: payment.id,
        reason: "commission_window_ended"
      });
    });

    it("grants nothing when the payer and the affiliate share a saved payment method", async () => {
      const { service, payment, affiliate, paymentMethodRepository, stripeTransactionRepository, refillService, logger } = setup({
        sharesPaymentMethod: true
      });

      await service.syncCommission(payment.id);

      expect(paymentMethodRepository.hasSharedFingerprint).toHaveBeenCalledWith(payment.userId, affiliate.userId);
      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "shared_payment_method" });
    });

    it("grants nothing to an affiliate whose wallet is locked for abuse", async () => {
      const { service, payment, affiliate, userWalletRepository, stripeTransactionRepository, refillService, logger } = setup({
        affiliateAbuseLockedAt: new Date()
      });

      await service.syncCommission(payment.id);

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(affiliate.userId);
      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "affiliate_abuse_locked" });
    });

    it("grants the commission of an affiliate who has no wallet yet", async () => {
      const { service, payment, affiliate, refillService } = setup({ affiliateHasWallet: false });

      await service.syncCommission(payment.id);

      expect(refillService.topUpWallet).toHaveBeenCalledWith(500, affiliate.userId, expect.anything());
    });

    it("does nothing when the payment already earned its commission", async () => {
      const { service, payment, stripeTransactionRepository, referralRepository, refillService } = setup({ hasCommission: true });

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.findAffiliateCommissionBySourceAndLock).toHaveBeenCalledWith(payment.id);
      expect(referralRepository.findWithAffiliateByReferredUserId).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("grants the commission of a payment that was refunded after it settled", async () => {
      const { service, payment, affiliate, refillService } = setup({ paymentStatus: "refunded", paymentAmount: 10000 });

      await service.syncCommission(payment.id);

      expect(refillService.topUpWallet).toHaveBeenCalledWith(500, affiliate.userId, expect.anything());
    });

    it.each(["created", "pending", "requires_action", "failed", "canceled"] as const)("does nothing for a %s payment", async paymentStatus => {
      const { service, payment, stripeTransactionRepository, refillService } = setup({ paymentStatus });

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.findAffiliateCommissionBySourceAndLock).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it.each(["coupon_claim", "manual_credit", "affiliate_commission"] as const)("does nothing for a %s transaction", async paymentType => {
      const { service, payment, stripeTransactionRepository, refillService } = setup({ paymentType });

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.findAffiliateCommissionBySourceAndLock).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("does nothing when the payment no longer exists", async () => {
      const { service, stripeTransactionRepository, refillService } = setup();
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(undefined);

      await service.syncCommission("missing-transaction-id");

      expect(stripeTransactionRepository.findAffiliateCommissionBySourceAndLock).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("treats a commission that another sync recorded first as already granted", async () => {
      const { service, payment, stripeTransactionRepository, refillService, analyticsService, logger } = setup();
      stripeTransactionRepository.createAffiliateCommission.mockRejectedValue(createUniqueViolation("stripe_transactions_source_transaction_id_unique"));

      await expect(service.syncCommission(payment.id)).resolves.toBeUndefined();

      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_ALREADY_GRANTED", transactionId: payment.id });
    });

    it("rethrows any other failure to record the commission so the job retries", async () => {
      const { service, payment, stripeTransactionRepository, refillService } = setup();
      const error = new Error("connection terminated");
      stripeTransactionRepository.createAffiliateCommission.mockRejectedValue(error);

      await expect(service.syncCommission(payment.id)).rejects.toBe(error);

      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("rethrows a failed top-up so the job retries without reporting a grant", async () => {
      const { service, payment, refillService, analyticsService } = setup();
      const error = new Error("signer unavailable");
      refillService.topUpWallet.mockRejectedValue(error);

      await expect(service.syncCommission(payment.id)).rejects.toBe(error);

      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    describe("when the referred payment is refunded or lost to a dispute", () => {
      it("takes back 200 of a 500 cent commission when 40% of a $100 payment is refunded", async () => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService, analyticsService, logger } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentAmountRefunded: 4000,
          commissionAmount: 500
        });

        await service.syncCommission(payment.id);

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { amountRefunded: 200 });
        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(200, affiliate.userId, { currency: "usd", transactionId: commission.id });
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

        await service.syncCommission(payment.id);

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { amountRefunded: 500, status: "refunded" });
        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(300, affiliate.userId, { currency: "usd", transactionId: commission.id });
      });

      it("takes back nothing more when a later sync finds the refund already reversed", async () => {
        const { service, payment, stripeTransactionRepository, refillService, analyticsService } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentAmountRefunded: 4000,
          commissionAmount: 500,
          commissionAmountRefunded: 200
        });

        await service.syncCommission(payment.id);

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
        expect(analyticsService.track).not.toHaveBeenCalled();
      });

      it("never gives back commission it already took back", async () => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentAmountRefunded: 0,
          commissionAmount: 500,
          commissionAmountRefunded: 200
        });

        await service.syncCommission(payment.id);

        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
        expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
      });

      it.each([
        { paymentAmountRefunded: 1, expectedUpdates: [] },
        { paymentAmountRefunded: 34, expectedUpdates: [{ amountRefunded: 1 }] },
        { paymentAmountRefunded: 1000, expectedUpdates: [{ amountRefunded: 50 }] }
      ])(
        "keeps the commission of a 1234 cent payment at 5% of what is left after a $paymentAmountRefunded cent refund, rounded down",
        async ({ paymentAmountRefunded, expectedUpdates }) => {
          const { service, payment, stripeTransactionRepository } = setup({
            hasCommission: true,
            paymentAmount: 1234,
            paymentAmountRefunded,
            commissionAmount: 61
          });

          await service.syncCommission(payment.id);

          expect(stripeTransactionRepository.updateById.mock.calls.map(([, update]) => update)).toEqual(expectedUpdates);
        }
      );

      it("takes back the whole commission when the payer lost a dispute", async () => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService, analyticsService, logger } = setup({
          hasCommission: true,
          paymentAmount: 10000,
          paymentDisputeLostAt: new Date(),
          commissionAmount: 500
        });

        await service.syncCommission(payment.id);

        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { amountRefunded: 500, status: "refunded" });
        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(500, affiliate.userId, { currency: "usd", transactionId: commission.id });
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

        await service.syncCommission(payment.id);

        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(300, affiliate.userId, { currency: "usd", transactionId: commission.id });
      });

      it("still takes back the commission of an affiliate who was revoked since", async () => {
        const { service, payment, affiliate, refillService } = setup({
          hasCommission: true,
          affiliateRevokedAt: new Date().toISOString(),
          paymentAmount: 10000,
          paymentAmountRefunded: 10000,
          commissionAmount: 500
        });

        await service.syncCommission(payment.id);

        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(500, affiliate.userId, expect.anything());
      });

      it("still takes back the commission while the affiliate program flag is off", async () => {
        const { service, payment, affiliate, refillService, featureFlagsService } = setup({
          hasCommission: true,
          isProgramEnabled: false,
          paymentAmount: 10000,
          paymentAmountRefunded: 10000,
          commissionAmount: 500
        });

        await service.syncCommission(payment.id);

        expect(featureFlagsService.isEnabled).not.toHaveBeenCalled();
        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(500, affiliate.userId, expect.anything());
      });

      it("grants and then takes back in the same sync the commission of a payment refunded before its first sync", async () => {
        const { service, payment, affiliate, commission, stripeTransactionRepository, refillService } = setup({
          paymentStatus: "refunded",
          paymentAmount: 10000,
          paymentAmountRefunded: 10000
        });

        await service.syncCommission(payment.id);

        expect(refillService.topUpWallet).toHaveBeenCalledWith(500, affiliate.userId, expect.anything());
        expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(commission.id, { amountRefunded: 500, status: "refunded" });
        expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(500, affiliate.userId, { currency: "usd", transactionId: commission.id });
        expect(refillService.topUpWallet.mock.invocationCallOrder[0]).toBeLessThan(refillService.reduceWalletBalance.mock.invocationCallOrder[0]);
      });

      it("records the reversal before reducing the affiliate's wallet", async () => {
        const { service, payment, stripeTransactionRepository, refillService } = setup({
          hasCommission: true,
          paymentAmountRefunded: 4000
        });

        await service.syncCommission(payment.id);

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

        await service.syncCommission(payment.id);

        expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_COMMISSION_REVERSED", amountCents: 500, shortfallCents: 120 }));
      });

      it("rethrows a failed wallet reduction so the job retries without reporting a reversal", async () => {
        const { service, payment, refillService, analyticsService } = setup({ hasCommission: true, paymentAmountRefunded: 4000 });
        const error = new Error("signer unavailable");
        refillService.reduceWalletBalance.mockRejectedValue(error);

        await expect(service.syncCommission(payment.id)).rejects.toBe(error);

        expect(analyticsService.track).not.toHaveBeenCalled();
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

  function setup(
    input: {
      paymentAmount?: number;
      paymentAmountRefunded?: number;
      paymentDisputeLostAt?: Date;
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
      commissionAmount?: number;
      commissionAmountRefunded?: number;
      shortfallCents?: number;
    } = {}
  ) {
    const affiliate = createAffiliate({ revokedAt: input.affiliateRevokedAt ?? null });
    const payment = generateDatabaseStripeTransaction({
      type: input.paymentType ?? "payment_intent",
      status: input.paymentStatus ?? "succeeded",
      amount: input.paymentAmount ?? 10000,
      amountRefunded: input.paymentAmountRefunded ?? 0,
      disputeLostAt: input.paymentDisputeLostAt ?? null,
      createdAt: input.paymentCreatedAt ?? new Date()
    });
    const referral = createReferral({ referredUserId: payment.userId, affiliateId: affiliate.id, createdAt: input.referredAt ?? new Date().toISOString() });
    const commission = generateDatabaseStripeTransaction({
      userId: affiliate.userId,
      type: "affiliate_commission",
      status: "succeeded",
      amount: input.commissionAmount ?? 500,
      amountRefunded: input.commissionAmountRefunded ?? 0,
      sourceTransactionId: payment.id
    });
    const affiliateWallet = createUserWallet({ userId: affiliate.userId, abuseLockedAt: input.affiliateAbuseLockedAt ?? null });

    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    stripeTransactionRepository.findOneByAndLock.mockResolvedValue(payment);
    stripeTransactionRepository.findAffiliateCommissionBySourceAndLock.mockResolvedValue(input.hasCommission ? commission : undefined);
    stripeTransactionRepository.createAffiliateCommission.mockImplementation(async created => ({ ...commission, ...created }));

    const referralRepository = mock<ReferralRepository>();
    referralRepository.findWithAffiliateByReferredUserId.mockResolvedValue(input.isReferred === false ? undefined : { referral, affiliate });

    const paymentMethodRepository = mock<PaymentMethodRepository>();
    paymentMethodRepository.hasSharedFingerprint.mockResolvedValue(input.sharesPaymentMethod ?? false);

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

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new AffiliateCommissionService(
      stripeTransactionRepository,
      referralRepository,
      paymentMethodRepository,
      userWalletRepository,
      refillService,
      featureFlagsService,
      analyticsService,
      txService,
      createLogger
    );

    return {
      service,
      payment,
      affiliate,
      referral,
      commission,
      stripeTransactionRepository,
      referralRepository,
      paymentMethodRepository,
      userWalletRepository,
      refillService,
      featureFlagsService,
      analyticsService,
      txService,
      logger
    };
  }
});
