import type { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeTransactionRepository } from "@src/billing/repositories";
import type { FirstPurchaseBonusService } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import { IDEMPOTENCY_KEY_MISMATCH_ERROR_MESSAGE, PAYMENT_IN_PROGRESS_ERROR_MESSAGE } from "@src/billing/services/stripe-error/stripe-error.service";
import type { TimerService } from "@src/core/services/timer/timer.service";
import { StripeTransactionService } from "./stripe-transaction.service";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { create as StripeSeederCreate } from "@test/seeders/stripe.seeder";
import { createTestPaymentIntent, TEST_CONSTANTS } from "@test/seeders/stripe-test-data.seeder";

describe(StripeTransactionService.name, () => {
  describe("createPaymentIntent", () => {
    const mockPaymentParams = {
      userId: TEST_CONSTANTS.USER_ID,
      customer: TEST_CONSTANTS.CUSTOMER_ID,
      payment_method: TEST_CONSTANTS.PAYMENT_METHOD_ID,
      amount: 100,
      confirm: true,
      onAmountMismatch: "reject" as const
    };

    it("creates the transaction and payment intent in USD regardless of caller input", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
      const result = await service.createPaymentIntent(mockPaymentParams);
      expect(stripeTransactionRepository.create).toHaveBeenCalledWith({
        userId: mockPaymentParams.userId,
        type: "payment_intent",
        status: "created",
        amount: 10000,
        currency: "usd"
      });
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith({
        customer: mockPaymentParams.customer,
        payment_method: mockPaymentParams.payment_method,
        amount: 10000,
        currency: "usd",
        confirm: mockPaymentParams.confirm,
        payment_method_types: ["card", "link"],
        metadata: {
          internal_transaction_id: "test-transaction-id"
        }
      });
      expect(result).toEqual({
        success: true,
        paymentIntentId: StripeSeederCreate().paymentIntent.id,
        transactionId: "test-transaction-id",
        transactionStatus: "created"
      });
    });

    it("does not consult the idempotency-key row lookup on keyless calls", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();

      await service.createPaymentIntent(mockPaymentParams);

      expect(stripeTransactionRepository.findOrCreateByIdempotencyKey).not.toHaveBeenCalled();
      expect(vi.mocked(stripe.paymentIntents.create).mock.calls[0]).toHaveLength(1);
    });

    describe("when an idempotency key is provided", () => {
      const idempotencyKey = `topup_${TEST_CONSTANTS.USER_ID}_11111111-2222-4333-8444-555555555555`;
      const keyedParams = { ...mockPaymentParams, idempotencyKey };

      it("finds or creates the row by key and forwards the key to Stripe", async () => {
        const { service, stripe, stripeTransactionRepository } = setup();
        const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "created", stripeIdempotencyKey: idempotencyKey });
        stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: true });

        const result = await service.createPaymentIntent(keyedParams);

        expect(stripeTransactionRepository.findOrCreateByIdempotencyKey).toHaveBeenCalledWith({
          userId: keyedParams.userId,
          type: "payment_intent",
          status: "created",
          amount: 10000,
          currency: "usd",
          stripeIdempotencyKey: idempotencyKey
        });
        expect(stripeTransactionRepository.create).not.toHaveBeenCalled();
        expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 10000,
            metadata: { internal_transaction_id: transaction.id }
          }),
          { idempotencyKey }
        );
        expect(result).toEqual(expect.objectContaining({ success: true, transactionId: transaction.id }));
      });

      it.each(["succeeded", "refunded"] as const)("short-circuits a replay of a %s row without contacting Stripe", async status => {
        const { service, stripe, stripeTransactionRepository } = setup();
        const transaction = generateDatabaseStripeTransaction({ amount: 10000, status, stripePaymentIntentId: "pi_replayed" });
        stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: false });

        const result = await service.createPaymentIntent(keyedParams);

        expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
        expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
        expect(result).toEqual({
          success: true,
          paymentIntentId: "pi_replayed",
          transactionId: transaction.id,
          transactionStatus: status
        });
      });

      it.each(["succeeded", "requires_capture"] as const)(
        "retrieves the live intent instead of creating one and defers the %s status to the webhook",
        async liveStatus => {
          const { service, stripe, stripeTransactionRepository } = setup();
          const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "pending", stripePaymentIntentId: "pi_live" });
          stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: false });
          vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue(createTestPaymentIntent({ id: "pi_live", status: liveStatus }));

          const result = await service.createPaymentIntent(keyedParams);

          expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith("pi_live");
          expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
          expect(stripeTransactionRepository.updateByIdUnlessSettled).not.toHaveBeenCalled();
          expect(result).toEqual({
            success: true,
            paymentIntentId: "pi_live",
            transactionId: transaction.id,
            transactionStatus: "pending"
          });
        }
      );

      it("records the mapped status when the live intent is processing", async () => {
        const { service, stripe, stripeTransactionRepository } = setup();
        const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "requires_action", stripePaymentIntentId: "pi_live" });
        stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: false });
        vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue(createTestPaymentIntent({ id: "pi_live", status: "processing" }));

        const result = await service.createPaymentIntent(keyedParams);

        expect(stripeTransactionRepository.updateByIdUnlessSettled).toHaveBeenCalledWith(transaction.id, { status: "pending" });
        expect(result).toEqual(expect.objectContaining({ success: true, transactionStatus: "pending" }));
      });

      it.each(["requires_action", "requires_confirmation"] as const)("resumes 3DS with the live client secret when the intent is in %s", async liveStatus => {
        const { service, stripe, stripeTransactionRepository } = setup();
        const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "requires_action", stripePaymentIntentId: "pi_live" });
        stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: false });
        vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue(
          createTestPaymentIntent({ id: "pi_live", status: liveStatus, client_secret: "pi_live_secret" })
        );

        const result = await service.createPaymentIntent(keyedParams);

        expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
        expect(result).toEqual({
          success: false,
          paymentIntentId: "pi_live",
          requiresAction: true,
          clientSecret: "pi_live_secret",
          transactionId: transaction.id,
          transactionStatus: "requires_action"
        });
      });

      it("defers the succeeded status to the webhook when a fresh keyed charge requires capture", async () => {
        const { service, stripeTransactionRepository } = setup({ paymentIntent: createTestPaymentIntent({ status: "requires_capture" }) });
        const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "created", stripeIdempotencyKey: idempotencyKey });
        stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: true });

        const result = await service.createPaymentIntent(keyedParams);

        expect(stripeTransactionRepository.updateByIdUnlessSettled).toHaveBeenCalledWith(transaction.id, {
          stripePaymentIntentId: createTestPaymentIntent().id
        });
        expect(result).toEqual(expect.objectContaining({ success: true, transactionStatus: "created" }));
      });

      it("synthesizes a 402 with the live decline reason when the intent requires a new payment method", async () => {
        const { service, stripe, stripeTransactionRepository } = setup();
        const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "pending", stripePaymentIntentId: "pi_live" });
        stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: false });
        vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue(
          createTestPaymentIntent({
            id: "pi_live",
            status: "requires_payment_method",
            last_payment_error: { message: "Your card was declined." } as Stripe.PaymentIntent.LastPaymentError
          })
        );

        await expect(service.createPaymentIntent(keyedParams)).rejects.toMatchObject({
          status: 402,
          message: "Your card was declined.",
          errorCode: "card_declined"
        });
        expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
        expect(stripeTransactionRepository.updateByIdUnlessSettled).toHaveBeenCalledWith(transaction.id, {
          status: "failed",
          errorMessage: "Your card was declined."
        });
      });

      it("rejects a reused key whose amount changed under the reject policy without touching the row or Stripe", async () => {
        const { service, stripe, stripeTransactionRepository } = setup();
        const transaction = generateDatabaseStripeTransaction({ amount: 5000, status: "created", stripePaymentIntentId: null });
        stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: false });

        await expect(service.createPaymentIntent(keyedParams)).rejects.toThrow(IDEMPOTENCY_KEY_MISMATCH_ERROR_MESSAGE);
        expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
        expect(stripeTransactionRepository.updateByIdUnlessSettled).not.toHaveBeenCalled();
      });

      it.each(["succeeded", "refunded"] as const)(
        "rejects a reused key whose amount changed under the reject policy instead of replaying the %s row",
        async status => {
          const { service, stripe, stripeTransactionRepository } = setup();
          const transaction = generateDatabaseStripeTransaction({ amount: 5000, status, stripePaymentIntentId: "pi_replayed" });
          stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: false });

          await expect(service.createPaymentIntent(keyedParams)).rejects.toThrow(IDEMPOTENCY_KEY_MISMATCH_ERROR_MESSAGE);
          expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
          expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
        }
      );

      it("rejects a reused key whose amount changed under the reject policy before resuming the recorded intent", async () => {
        const { service, stripe, stripeTransactionRepository } = setup();
        const transaction = generateDatabaseStripeTransaction({ amount: 5000, status: "pending", stripePaymentIntentId: "pi_live" });
        stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: false });

        await expect(service.createPaymentIntent(keyedParams)).rejects.toThrow(IDEMPOTENCY_KEY_MISMATCH_ERROR_MESSAGE);
        expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
        expect(stripeTransactionRepository.updateByIdUnlessSettled).not.toHaveBeenCalled();
      });

      it("charges the recorded amount when the tolerate policy sees a recomputed amount", async () => {
        const { service, stripe, stripeTransactionRepository } = setup();
        const reloadKey = "WalletBalanceReloadCheck.job_1";
        const transaction = generateDatabaseStripeTransaction({
          amount: 5000,
          status: "created",
          stripePaymentIntentId: null,
          stripeIdempotencyKey: reloadKey
        });
        stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: false });

        const result = await service.createPaymentIntent({ ...mockPaymentParams, idempotencyKey: reloadKey, onAmountMismatch: "tolerate" });

        expect(stripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 5000 }), { idempotencyKey: reloadKey });
        expect(result).toEqual(expect.objectContaining({ success: true, transactionId: transaction.id }));
      });

      it("maps a concurrent key-in-use rejection to the in-progress error without touching the row", async () => {
        const { service, stripe, stripeTransactionRepository } = setup();
        const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "created", stripePaymentIntentId: null });
        stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: false });
        vi.mocked(stripe.paymentIntents.create).mockRejectedValue(
          new Stripe.errors.StripeInvalidRequestError({
            type: "invalid_request_error",
            code: "idempotency_key_in_use",
            message: "There is currently another in-progress request using this Idempotent Key"
          } as Stripe.StripeRawError)
        );

        await expect(service.createPaymentIntent(keyedParams)).rejects.toThrow(PAYMENT_IN_PROGRESS_ERROR_MESSAGE);
        expect(stripeTransactionRepository.updateByIdUnlessSettled).not.toHaveBeenCalled();
      });

      it("rethrows a params-mismatch idempotency error without recording a failure", async () => {
        const { service, stripe, stripeTransactionRepository } = setup();
        const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "created", stripePaymentIntentId: null });
        stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: true });
        const idempotencyError = new Stripe.errors.StripeIdempotencyError({
          type: "idempotency_error",
          message: "Keys for idempotent requests can only be used with the same parameters they were first used with."
        } as Stripe.StripeRawError);
        vi.mocked(stripe.paymentIntents.create).mockRejectedValue(idempotencyError);

        await expect(service.createPaymentIntent(keyedParams)).rejects.toBe(idempotencyError);
        expect(stripeTransactionRepository.updateByIdUnlessSettled).not.toHaveBeenCalled();
      });

      it("records failures through the settled-status guard", async () => {
        const { service, stripe, stripeTransactionRepository } = setup();
        const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "created", stripePaymentIntentId: null });
        stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: true });
        vi.mocked(stripe.paymentIntents.create).mockRejectedValue(new Error("socket hang up"));

        await expect(service.createPaymentIntent(keyedParams)).rejects.toThrow("socket hang up");
        expect(stripeTransactionRepository.updateByIdUnlessSettled).toHaveBeenCalledWith(
          transaction.id,
          expect.objectContaining({ status: "failed", errorMessage: "socket hang up" })
        );
        expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      });

      describe("when a webhook settles the row mid-request", () => {
        it("responds with the settled outcome when the guard suppresses the fresh-charge update", async () => {
          const { service, stripeTransactionRepository } = setup();
          const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "created", stripeIdempotencyKey: idempotencyKey });
          stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: true });
          stripeTransactionRepository.updateByIdUnlessSettled.mockResolvedValue(undefined);
          stripeTransactionRepository.findById.mockResolvedValue({ ...transaction, status: "succeeded", stripePaymentIntentId: "pi_settled" });

          const result = await service.createPaymentIntent(keyedParams);

          expect(result).toEqual({
            success: true,
            paymentIntentId: "pi_settled",
            transactionId: transaction.id,
            transactionStatus: "succeeded"
          });
        });

        it("responds with the settled outcome when the guard suppresses the resumed-intent update", async () => {
          const { service, stripe, stripeTransactionRepository } = setup();
          const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "pending", stripePaymentIntentId: "pi_live" });
          stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: false });
          vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue(createTestPaymentIntent({ id: "pi_live", status: "processing" }));
          stripeTransactionRepository.updateByIdUnlessSettled.mockResolvedValue(undefined);
          stripeTransactionRepository.findById.mockResolvedValue({ ...transaction, status: "succeeded" });

          const result = await service.createPaymentIntent(keyedParams);

          expect(result).toEqual({
            success: true,
            paymentIntentId: "pi_live",
            transactionId: transaction.id,
            transactionStatus: "succeeded"
          });
        });

        it("responds with the settled outcome instead of throwing the stale decline", async () => {
          const { service, stripe, stripeTransactionRepository } = setup();
          const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "pending", stripePaymentIntentId: "pi_live" });
          stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: false });
          vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue(createTestPaymentIntent({ id: "pi_live", status: "requires_payment_method" }));
          stripeTransactionRepository.updateByIdUnlessSettled.mockResolvedValue(undefined);
          stripeTransactionRepository.findById.mockResolvedValue({ ...transaction, status: "succeeded" });

          const result = await service.createPaymentIntent(keyedParams);

          expect(result).toEqual(expect.objectContaining({ success: true, transactionStatus: "succeeded" }));
        });

        it("responds with the settled outcome instead of rethrowing a stale charge error", async () => {
          const { service, stripe, stripeTransactionRepository } = setup();
          const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "created", stripeIdempotencyKey: idempotencyKey });
          stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: true });
          vi.mocked(stripe.paymentIntents.create).mockRejectedValue(new Error("socket hang up"));
          stripeTransactionRepository.updateByIdUnlessSettled.mockResolvedValue(undefined);
          stripeTransactionRepository.findById.mockResolvedValue({ ...transaction, status: "succeeded", stripePaymentIntentId: "pi_settled" });

          const result = await service.createPaymentIntent(keyedParams);

          expect(result).toEqual(expect.objectContaining({ success: true, paymentIntentId: "pi_settled", transactionStatus: "succeeded" }));
        });

        it("rethrows the original error when the suppressed row is not actually settled", async () => {
          const { service, stripe, stripeTransactionRepository } = setup();
          const transaction = generateDatabaseStripeTransaction({ amount: 10000, status: "created", stripeIdempotencyKey: idempotencyKey });
          stripeTransactionRepository.findOrCreateByIdempotencyKey.mockResolvedValue({ transaction, isNew: true });
          vi.mocked(stripe.paymentIntents.create).mockRejectedValue(new Error("socket hang up"));
          stripeTransactionRepository.updateByIdUnlessSettled.mockResolvedValue(undefined);
          stripeTransactionRepository.findById.mockResolvedValue({ ...transaction, status: "failed" });

          await expect(service.createPaymentIntent(keyedParams)).rejects.toThrow("socket hang up");
        });
      });
    });
  });

  describe("resolveTransaction", () => {
    it("returns transaction once it reaches terminal status", async () => {
      const { service, stripeTransactionRepository } = setup();
      const terminalTransaction = generateDatabaseStripeTransaction({ id: "tx_1", status: "succeeded" });

      stripeTransactionRepository.findById.mockResolvedValue(terminalTransaction);

      const result = await service.resolveTransaction("tx_1");

      expect(result).toEqual(terminalTransaction);
      expect(stripeTransactionRepository.findById).toHaveBeenCalledWith("tx_1");
    }, 10_000);

    it("keeps polling until transaction reaches terminal status", async () => {
      const { service, stripeTransactionRepository } = setup();
      const pendingTransaction = generateDatabaseStripeTransaction({ id: "tx_1", status: "pending" });
      const succeededTransaction = generateDatabaseStripeTransaction({ id: "tx_1", status: "succeeded" });

      stripeTransactionRepository.findById
        .mockResolvedValueOnce(pendingTransaction)
        .mockResolvedValueOnce(pendingTransaction)
        .mockResolvedValueOnce(succeededTransaction);

      const result = await service.resolveTransaction("tx_1");

      expect(result).toEqual(succeededTransaction);
      expect(stripeTransactionRepository.findById).toHaveBeenCalledTimes(3);
    }, 10_000);

    it("throws 404 when transaction is not found", async () => {
      const { service, stripeTransactionRepository } = setup();

      stripeTransactionRepository.findById.mockResolvedValue(undefined);

      await expect(service.resolveTransaction("tx_nonexistent")).rejects.toMatchObject({ status: 404 });
    }, 10_000);

    it("resolves with failed status as terminal", async () => {
      const { service, stripeTransactionRepository } = setup();
      const failedTransaction = generateDatabaseStripeTransaction({ id: "tx_1", status: "failed" });

      stripeTransactionRepository.findById.mockResolvedValue(failedTransaction);

      const result = await service.resolveTransaction("tx_1");

      expect(result).toEqual(failedTransaction);
    }, 10_000);
  });

  describe("recordCouponClaim", () => {
    it("creates a pending coupon_claim transaction with the coupon metadata", async () => {
      const { service, stripeTransactionRepository } = setup();

      const result = await service.recordCouponClaim({
        userId: "user_1",
        amount: 1000,
        currency: "usd",
        couponId: "coupon_1",
        promotionCodeId: "promo_1",
        invoiceId: "in_1",
        description: "Coupon: Test"
      });

      expect(stripeTransactionRepository.create).toHaveBeenCalledWith({
        userId: "user_1",
        type: "coupon_claim",
        status: "pending",
        amount: 1000,
        currency: "usd",
        stripeCouponId: "coupon_1",
        stripePromotionCodeId: "promo_1",
        stripeInvoiceId: "in_1",
        description: "Coupon: Test"
      });
      expect(result).toEqual(expect.objectContaining({ type: "coupon_claim" }));
    });
  });

  function setup(params: { paymentIntent?: Stripe.Response<Stripe.PaymentIntent> } = {}) {
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    const timerService = mock<TimerService>();

    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });

    const service = new StripeTransactionService(
      stripe,
      stripeTransactionRepository,
      mock<RefillService>(),
      mock<FirstPurchaseBonusService>(),
      timerService,
      () => mock<LoggerService>()
    );

    stripeTransactionRepository.create.mockImplementation(async input => ({
      id: "test-transaction-id",
      userId: input.userId,
      type: input.type,
      status: input.status ?? "created",
      amount: input.amount,
      amountRefunded: input.amountRefunded ?? 0,
      bonusAmount: input.bonusAmount ?? 0,
      currency: input.currency ?? "usd",
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      stripeChargeId: input.stripeChargeId ?? null,
      stripeCouponId: input.stripeCouponId ?? null,
      stripePromotionCodeId: input.stripePromotionCodeId ?? null,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      stripeIdempotencyKey: input.stripeIdempotencyKey ?? null,
      paymentMethodType: input.paymentMethodType ?? null,
      cardBrand: input.cardBrand ?? null,
      cardLast4: input.cardLast4 ?? null,
      receiptUrl: input.receiptUrl ?? null,
      description: input.description ?? null,
      errorMessage: input.errorMessage ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    stripeTransactionRepository.updateById.mockResolvedValue(undefined);

    const stripeData = StripeSeederCreate();
    const paymentIntentToReturn = params.paymentIntent || stripeData.paymentIntent;
    vi.spyOn(stripe.paymentIntents, "create").mockResolvedValue(paymentIntentToReturn);
    vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(paymentIntentToReturn);

    return {
      service,
      stripe,
      stripeTransactionRepository,
      timerService
    };
  }
});
