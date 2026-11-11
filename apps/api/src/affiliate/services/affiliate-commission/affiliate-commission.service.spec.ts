import type { CreateLogger } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import { PostgresError } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateOutput } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import type { ReferralOutput, ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import type { PaymentMethodRepository, StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { AffiliateCommissionService } from "./affiliate-commission.service";

import { createAffiliate } from "@test/seeders/affiliate.seeder";
import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createOrganization } from "@test/seeders/organization.seeder";
import { createReferral } from "@test/seeders/referral.seeder";

describe(AffiliateCommissionService.name, () => {
  describe("syncCommission", () => {
    it("credits the affiliate's personal organization 5% of a referred user's card payment", async () => {
      const { service, payment, affiliate, affiliatePersonalOrganization, commission, stripeTransactionRepository, refillService, analyticsService, logger } =
        setup({
          paymentAmount: 10000
        });

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalledWith({
        userId: affiliate.userId,
        organizationId: affiliatePersonalOrganization.id,
        amount: 500,
        sourceTransactionId: payment.id
      });
      expect(refillService.topUpWallet).toHaveBeenCalledWith(
        500,
        { userId: affiliate.userId, organizationId: affiliatePersonalOrganization.id },
        {
          endTrial: false,
          liftAbuseLock: false,
          payment: { source: "affiliate_commission", transactionId: commission.id, currency: "usd" }
        }
      );
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

      expect(refillService.topUpWallet).toHaveBeenCalledWith(commissionAmount, expect.objectContaining({ userId: affiliate.userId }), expect.anything());
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
      const { service, payment, referralRepository, stripeTransactionRepository, refillService, logger } = setup({ isReferred: false });

      await service.syncCommission(payment.id);

      expect(referralRepository.findWithAffiliateByReferredUserId).toHaveBeenCalledWith(payment.userId);
      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
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

      expect(paymentMethodRepository.hasSharedFingerprint).toHaveBeenCalledWith({ userId: payment.userId, organizationId: null }, affiliate.userId);
      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "shared_payment_method" });
    });

    it("credits a payment by a team the referred user created, whichever member paid", async () => {
      const referredUserId = faker.string.uuid();
      const team = createOrganization({ type: "team", createdByUserId: referredUserId });
      const { service, payment, affiliate, referralRepository, paymentMethodRepository, refillService, analyticsService } = setup({
        paymentOrganization: team
      });

      await service.syncCommission(payment.id);

      expect(referralRepository.findWithAffiliateByReferredUserId).toHaveBeenCalledWith(referredUserId);
      expect(paymentMethodRepository.hasSharedFingerprint).toHaveBeenCalledWith({ userId: referredUserId, organizationId: team.id }, affiliate.userId);
      expect(refillService.topUpWallet).toHaveBeenCalledWith(500, expect.objectContaining({ userId: affiliate.userId }), expect.anything());
      expect(analyticsService.track).toHaveBeenCalledWith(
        affiliate.userId,
        "affiliate_commission_granted",
        expect.objectContaining({ referred_user_id: referredUserId })
      );
    });

    it("counts a personal organization's payment for the user it belongs to", async () => {
      const owner = faker.string.uuid();
      const personal = createOrganization({ type: "personal", createdByUserId: owner });
      const { service, payment, referralRepository, organizationRepository } = setup({ paymentOrganization: personal });

      await service.syncCommission(payment.id);

      expect(organizationRepository.findById).toHaveBeenCalledWith(personal.id);
      expect(referralRepository.findWithAffiliateByReferredUserId).toHaveBeenCalledWith(owner);
    });

    it.each([
      { case: "whose creator deleted their account", paymentOrganization: createOrganization({ type: "team", createdByUserId: null }) },
      { case: "that no longer exists", paymentOrganization: createOrganization({ type: "team" }), isOrganizationGone: true }
    ])("grants nothing for a payment by an organization $case", async ({ paymentOrganization, isOrganizationGone }) => {
      const { service, payment, referralRepository, refillService, logger } = setup({ paymentOrganization, isOrganizationGone });

      await service.syncCommission(payment.id);

      expect(referralRepository.findWithAffiliateByReferredUserId).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason: "not_referred" });
    });

    it("records and credits the commission with no organization for an affiliate who has no personal organization yet", async () => {
      const { service, payment, affiliate, stripeTransactionRepository, refillService } = setup({ affiliateHasPersonalOrganization: false });

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.createAffiliateCommission).toHaveBeenCalledWith(expect.objectContaining({ organizationId: null }));
      expect(refillService.topUpWallet).toHaveBeenCalledWith(500, { userId: affiliate.userId, organizationId: null }, expect.anything());
    });

    it("does nothing when the payment already earned its commission", async () => {
      const { service, payment, stripeTransactionRepository, referralRepository, refillService } = setup({ hasCommission: true });

      await service.syncCommission(payment.id);

      expect(stripeTransactionRepository.findAffiliateCommissionBySourceAndLock).toHaveBeenCalledWith(payment.id);
      expect(referralRepository.findWithAffiliateByReferredUserId).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.createAffiliateCommission).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("grants the commission of a payment that was refunded after it settled", async () => {
      const { service, payment, affiliate, refillService } = setup({ paymentStatus: "refunded", paymentAmount: 10000 });

      await service.syncCommission(payment.id);

      expect(refillService.topUpWallet).toHaveBeenCalledWith(500, expect.objectContaining({ userId: affiliate.userId }), expect.anything());
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
  });

  function setup(
    input: {
      paymentAmount?: number;
      paymentStatus?: StripeTransactionOutput["status"];
      paymentType?: StripeTransactionOutput["type"];
      paymentCreatedAt?: Date;
      referredAt?: ReferralOutput["createdAt"];
      affiliateRevokedAt?: AffiliateOutput["revokedAt"];
      isReferred?: boolean;
      isProgramEnabled?: boolean;
      sharesPaymentMethod?: boolean;
      hasCommission?: boolean;
      paymentOrganization?: OrganizationOutput;
      isOrganizationGone?: boolean;
      affiliateHasPersonalOrganization?: boolean;
    } = {}
  ) {
    const affiliate = createAffiliate({ revokedAt: input.affiliateRevokedAt ?? null });
    const affiliatePersonalOrganization = createOrganization({ type: "personal", createdByUserId: affiliate.userId });
    const payment = generateDatabaseStripeTransaction({
      type: input.paymentType ?? "payment_intent",
      status: input.paymentStatus ?? "succeeded",
      amount: input.paymentAmount ?? 10000,
      createdAt: input.paymentCreatedAt ?? new Date(),
      organizationId: input.paymentOrganization?.id ?? null
    });
    const referredUserId = input.paymentOrganization?.createdByUserId ?? payment.userId!;
    const referral = createReferral({ referredUserId, affiliateId: affiliate.id, createdAt: input.referredAt ?? new Date().toISOString() });
    const commission = generateDatabaseStripeTransaction({
      userId: affiliate.userId,
      type: "affiliate_commission",
      status: "succeeded",
      sourceTransactionId: payment.id
    });

    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    stripeTransactionRepository.findOneByAndLock.mockResolvedValue(payment);
    stripeTransactionRepository.findAffiliateCommissionBySourceAndLock.mockResolvedValue(input.hasCommission ? commission : undefined);
    stripeTransactionRepository.createAffiliateCommission.mockResolvedValue(commission);

    const referralRepository = mock<ReferralRepository>();
    referralRepository.findWithAffiliateByReferredUserId.mockResolvedValue(input.isReferred === false ? undefined : { referral, affiliate });

    const paymentMethodRepository = mock<PaymentMethodRepository>();
    paymentMethodRepository.hasSharedFingerprint.mockResolvedValue(input.sharesPaymentMethod ?? false);

    const organizationRepository = mock<OrganizationRepository>();
    organizationRepository.findById.mockResolvedValue(input.isOrganizationGone ? undefined : input.paymentOrganization);
    organizationRepository.findPersonalByUserId.mockResolvedValue(input.affiliateHasPersonalOrganization === false ? undefined : affiliatePersonalOrganization);

    const refillService = mock<RefillService>();
    refillService.topUpWallet.mockResolvedValue({ walletId: 1, address: "akash1affiliate" });

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
      organizationRepository,
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
      affiliatePersonalOrganization,
      referral,
      commission,
      stripeTransactionRepository,
      referralRepository,
      paymentMethodRepository,
      organizationRepository,
      refillService,
      featureFlagsService,
      analyticsService,
      txService,
      logger
    };
  }

  function createUniqueViolation(constraintName: string) {
    const driverError = Object.assign(Object.create(PostgresError.prototype), {
      name: "PostgresError",
      code: "23505",
      constraint_name: constraintName,
      message: `duplicate key value violates unique constraint "${constraintName}"`
    });

    return new Error("Failed query: insert into stripe_transactions", { cause: driverError });
  }
});
