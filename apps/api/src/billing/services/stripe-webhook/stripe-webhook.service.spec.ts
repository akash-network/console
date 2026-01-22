import { mock } from "jest-mock-extended";
import type Stripe from "stripe";

import type { PaymentMethodRepository, StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import { StripeWebhookService } from "@src/billing/services/stripe-webhook/stripe-webhook.service";
import type { UserRepository } from "@src/user/repositories";

import { createTestUser } from "@test/seeders/user-test.seeder";

describe(StripeWebhookService.name, () => {
  describe("tryToTopUpWalletFromPaymentIntent", () => {
    it("tops up wallet and updates transaction on successful payment", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService, stripeService } = setup();
      const mockUser = createTestUser();
      const chargeId = "ch_123";
      const paymentIntentId = "pi_123";
      const amount = 10000;
      const internalTransaction = createMockTransaction({ status: "created" });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findById.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.updateById.mockResolvedValue(undefined);
      refillService.topUpWallet.mockResolvedValue();
      (stripeService.charges.retrieve as jest.Mock).mockResolvedValue({
        id: chargeId,
        payment_method_details: { card: { brand: "visa", last4: "4242" } },
        receipt_url: "https://receipt.url"
      });

      const event = createPaymentIntentSucceededEvent({
        id: paymentIntentId,
        customer: mockUser.stripeCustomerId,
        amount,
        amount_received: amount,
        latest_charge: chargeId,
        payment_method_types: ["card"],
        metadata: {
          internal_transaction_id: internalTransaction.id
        }
      });

      await service.tryToTopUpWalletFromPaymentIntent(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: mockUser.stripeCustomerId });
      expect(stripeService.charges.retrieve).toHaveBeenCalledWith(chargeId);
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(internalTransaction.id, {
        status: "succeeded",
        stripeChargeId: chargeId,
        paymentMethodType: "card",
        cardBrand: "visa",
        cardLast4: "4242",
        receiptUrl: "https://receipt.url",
        stripePaymentIntentId: paymentIntentId
      });
      expect(refillService.topUpWallet).toHaveBeenCalledWith(amount, mockUser.id);
    });

    it("returns early when customer ID is missing", async () => {
      const { service, userRepository, refillService } = setup();

      const event = createPaymentIntentSucceededEvent({
        id: "pi_123",
        customer: null,
        amount: 10000,
        metadata: {}
      });

      await service.tryToTopUpWalletFromPaymentIntent(event);

      expect(userRepository.findOneBy).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("returns early when user is not found", async () => {
      const { service, userRepository, refillService } = setup();

      userRepository.findOneBy.mockResolvedValue(undefined);

      const event = createPaymentIntentSucceededEvent({
        id: "pi_123",
        customer: "cus_unknown",
        amount: 10000,
        metadata: {}
      });

      await service.tryToTopUpWalletFromPaymentIntent(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_unknown" });
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("returns early when payment was already processed (idempotency)", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const paymentIntentId = "pi_123";
      const internalTransaction = createMockTransaction({ id: "tx-123", status: "succeeded" });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findById.mockResolvedValue(internalTransaction);

      const event = createPaymentIntentSucceededEvent({
        id: paymentIntentId,
        customer: mockUser.stripeCustomerId,
        amount: 10000,
        metadata: {
          internal_transaction_id: internalTransaction.id
        }
      });

      await service.tryToTopUpWalletFromPaymentIntent(event);

      expect(stripeTransactionRepository.findById).toHaveBeenCalledWith(internalTransaction.id);
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
    });

    it("processes payment when transaction exists but is not succeeded", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const paymentIntentId = "pi_123";
      const internalTransaction = createMockTransaction({ id: "tx-123", status: "created" });
      const amount = 10000;

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findById.mockResolvedValue(internalTransaction);

      const event = createPaymentIntentSucceededEvent({
        id: paymentIntentId,
        customer: mockUser.stripeCustomerId,
        amount,
        metadata: {
          internal_transaction_id: internalTransaction.id
        }
      });

      await service.tryToTopUpWalletFromPaymentIntent(event);

      expect(stripeTransactionRepository.findById).toHaveBeenCalledWith(internalTransaction.id);
      expect(refillService.topUpWallet).toHaveBeenCalledWith(amount, mockUser.id);
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(
        "tx-123",
        expect.objectContaining({
          status: "succeeded",
          stripePaymentIntentId: "pi_123"
        })
      );
    });
  });

  describe("handlePaymentIntentFailed", () => {
    it("updates transaction status to failed with error message", async () => {
      const { service, stripeTransactionRepository } = setup();
      const paymentIntentId = "pi_123";
      const errorMessage = "Your card was declined.";

      stripeTransactionRepository.updateByPaymentIntentId.mockResolvedValue(undefined);

      const event = createPaymentIntentFailedEvent({
        id: paymentIntentId,
        last_payment_error: { type: "card_error", message: errorMessage } as Stripe.PaymentIntent.LastPaymentError
      });

      await service.handlePaymentIntentFailed(event);

      expect(stripeTransactionRepository.updateByPaymentIntentId).toHaveBeenCalledWith(paymentIntentId, {
        status: "failed",
        errorMessage
      });
    });

    it("uses default error message when none provided", async () => {
      const { service, stripeTransactionRepository } = setup();
      const paymentIntentId = "pi_123";

      stripeTransactionRepository.updateByPaymentIntentId.mockResolvedValue(undefined);

      const event = createPaymentIntentFailedEvent({
        id: paymentIntentId,
        last_payment_error: null
      });

      await service.handlePaymentIntentFailed(event);

      expect(stripeTransactionRepository.updateByPaymentIntentId).toHaveBeenCalledWith(paymentIntentId, {
        status: "failed",
        errorMessage: "Payment failed"
      });
    });
  });

  describe("handlePaymentIntentCanceled", () => {
    it("updates transaction status to canceled", async () => {
      const { service, stripeTransactionRepository } = setup();
      const paymentIntentId = "pi_123";

      stripeTransactionRepository.updateByPaymentIntentId.mockResolvedValue(undefined);

      const event = createPaymentIntentCanceledEvent({ id: paymentIntentId });

      await service.handlePaymentIntentCanceled(event);

      expect(stripeTransactionRepository.updateByPaymentIntentId).toHaveBeenCalledWith(paymentIntentId, {
        status: "canceled"
      });
    });
  });

  describe("handleChargeRefunded", () => {
    it("reduces wallet balance and updates transaction on full refund", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const chargeId = "ch_123";
      const transactionId = "tx-123";
      const refundedAmount = 5000;

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByChargeId.mockResolvedValue(createMockTransaction({ id: transactionId, amountRefunded: 0 }));
      stripeTransactionRepository.updateById.mockResolvedValue(undefined);
      refillService.reduceWalletBalance.mockResolvedValue();

      const event = createChargeRefundedEvent({
        id: chargeId,
        customer: mockUser.stripeCustomerId!,
        amount_refunded: refundedAmount,
        refunded: true
      });

      await service.handleChargeRefunded(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: mockUser.stripeCustomerId });
      expect(stripeTransactionRepository.findByChargeId).toHaveBeenCalledWith(chargeId);
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transactionId, { amountRefunded: refundedAmount, status: "refunded" });
      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(refundedAmount, mockUser.id);
    });

    it("calculates refund delta correctly for partial refunds", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const chargeId = "ch_123";
      const transactionId = "tx-123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      // Transaction already has 3000 refunded
      stripeTransactionRepository.findByChargeId.mockResolvedValue(createMockTransaction({ id: transactionId, amountRefunded: 3000 }));
      stripeTransactionRepository.updateById.mockResolvedValue(undefined);
      refillService.reduceWalletBalance.mockResolvedValue();

      // Second partial refund: total is now 8000, previously was 3000 in DB, so delta is 5000
      const event = createChargeRefundedEvent({
        id: chargeId,
        customer: mockUser.stripeCustomerId!,
        amount_refunded: 8000,
        refunded: false // Not fully refunded
      });

      await service.handleChargeRefunded(event);

      // Uses delta (8000 - 3000 = 5000), not cumulative (8000)
      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(5000, mockUser.id);
      // Updates amountRefunded but not status since not fully refunded
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transactionId, { amountRefunded: 8000 });
    });

    it("handles duplicate webhook delivery idempotently", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const chargeId = "ch_123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      // Transaction already has this refund processed (amountRefunded matches charge.amount_refunded)
      stripeTransactionRepository.findByChargeId.mockResolvedValue(createMockTransaction({ id: "tx-123", amountRefunded: 5000 }));

      const event = createChargeRefundedEvent({
        id: chargeId,
        customer: mockUser.stripeCustomerId!,
        amount_refunded: 5000, // Same as stored amountRefunded
        refunded: true
      });

      await service.handleChargeRefunded(event);

      // Should not process again
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("returns early when customer ID is missing", async () => {
      const { service, userRepository, refillService } = setup();

      const event = createChargeRefundedEvent({
        id: "ch_123",
        customer: null,
        amount_refunded: 5000,
        refunded: true
      });

      await service.handleChargeRefunded(event);

      expect(userRepository.findOneBy).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("returns early when user is not found", async () => {
      const { service, userRepository, refillService } = setup();

      userRepository.findOneBy.mockResolvedValue(undefined);

      const event = createChargeRefundedEvent({
        id: "ch_123",
        customer: "cus_unknown",
        amount_refunded: 5000,
        refunded: true
      });

      await service.handleChargeRefunded(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_unknown" });
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("returns early when transaction is not found", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByChargeId.mockResolvedValue(undefined);

      const event = createChargeRefundedEvent({
        id: "ch_123",
        customer: mockUser.stripeCustomerId!,
        amount_refunded: 5000,
        refunded: true
      });

      await service.handleChargeRefunded(event);

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("returns early when transaction is not in succeeded state", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByChargeId.mockResolvedValue(createMockTransaction({ id: "tx-123", status: "failed" }));

      const event = createChargeRefundedEvent({
        id: "ch_123",
        customer: mockUser.stripeCustomerId!,
        amount_refunded: 5000,
        refunded: true
      });

      await service.handleChargeRefunded(event);

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });
  });

  describe("handlePaymentMethodAttached", () => {
    it("creates payment method for new card", async () => {
      const { service, userRepository, paymentMethodRepository, stripeService } = setup();
      const mockUser = createTestUser({ stripeCustomerId: "cus_123" });
      const paymentMethodId = "pm_123";
      const fingerprint = "fp_abc123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      paymentMethodRepository.upsert.mockResolvedValue({
        paymentMethod: {
          id: "local-pm-123",
          userId: mockUser.id,
          fingerprint,
          paymentMethodId,
          isDefault: true,
          isValidated: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        isNew: true
      });
      stripeService.markRemotePaymentMethodAsDefault.mockResolvedValue(undefined);

      const event = createPaymentMethodAttachedEvent({
        id: paymentMethodId,
        customer: mockUser.stripeCustomerId!,
        fingerprint
      });

      await service.handlePaymentMethodAttached(event);

      expect(paymentMethodRepository.upsert).toHaveBeenCalledWith({
        userId: mockUser.id,
        fingerprint,
        paymentMethodId
      });
      expect(stripeService.markRemotePaymentMethodAsDefault).toHaveBeenCalledWith(paymentMethodId, mockUser);
    });

    it("handles duplicate webhook delivery gracefully (idempotency)", async () => {
      const { service, userRepository, paymentMethodRepository, stripeService } = setup();
      const mockUser = createTestUser({ stripeCustomerId: "cus_123" });
      const paymentMethodId = "pm_123";
      const fingerprint = "fp_abc123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      paymentMethodRepository.upsert.mockResolvedValue({
        paymentMethod: {
          id: "local-pm-123",
          userId: mockUser.id,
          fingerprint,
          paymentMethodId,
          isDefault: true,
          isValidated: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        isNew: false // Already existed
      });

      const event = createPaymentMethodAttachedEvent({
        id: paymentMethodId,
        customer: mockUser.stripeCustomerId!,
        fingerprint
      });

      await service.handlePaymentMethodAttached(event);

      expect(paymentMethodRepository.upsert).toHaveBeenCalled();
      // Should NOT call Stripe API when payment method already exists
      expect(stripeService.markRemotePaymentMethodAsDefault).not.toHaveBeenCalled();
    });

    it("does not set as default on Stripe when not the first payment method", async () => {
      const { service, userRepository, paymentMethodRepository, stripeService } = setup();
      const mockUser = createTestUser({ stripeCustomerId: "cus_123" });
      const paymentMethodId = "pm_456";
      const fingerprint = "fp_def456";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      paymentMethodRepository.upsert.mockResolvedValue({
        paymentMethod: {
          id: "local-pm-456",
          userId: mockUser.id,
          fingerprint,
          paymentMethodId,
          isDefault: false, // Not the default (not first payment method)
          isValidated: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        isNew: true
      });

      const event = createPaymentMethodAttachedEvent({
        id: paymentMethodId,
        customer: mockUser.stripeCustomerId!,
        fingerprint
      });

      await service.handlePaymentMethodAttached(event);

      expect(stripeService.markRemotePaymentMethodAsDefault).not.toHaveBeenCalled();
    });

    it("logs warning but does not fail when Stripe default sync fails", async () => {
      const { service, userRepository, paymentMethodRepository, stripeService } = setup();
      const mockUser = createTestUser({ stripeCustomerId: "cus_123" });
      const paymentMethodId = "pm_123";
      const fingerprint = "fp_abc123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      paymentMethodRepository.upsert.mockResolvedValue({
        paymentMethod: {
          id: "local-pm-123",
          userId: mockUser.id,
          fingerprint,
          paymentMethodId,
          isDefault: true,
          isValidated: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        isNew: true
      });
      stripeService.markRemotePaymentMethodAsDefault.mockRejectedValue(new Error("Stripe API error"));

      const event = createPaymentMethodAttachedEvent({
        id: paymentMethodId,
        customer: mockUser.stripeCustomerId!,
        fingerprint
      });

      // Should not throw
      await expect(service.handlePaymentMethodAttached(event)).resolves.not.toThrow();
    });

    it("returns early when customer ID is missing", async () => {
      const { service, userRepository, paymentMethodRepository } = setup();

      const event = createPaymentMethodAttachedEvent({
        id: "pm_123",
        customer: null,
        fingerprint: "fp_abc123"
      });

      await service.handlePaymentMethodAttached(event);

      expect(userRepository.findOneBy).not.toHaveBeenCalled();
      expect(paymentMethodRepository.upsert).not.toHaveBeenCalled();
    });

    it("returns early when user is not found", async () => {
      const { service, userRepository, paymentMethodRepository } = setup();

      userRepository.findOneBy.mockResolvedValue(undefined);

      const event = createPaymentMethodAttachedEvent({
        id: "pm_123",
        customer: "cus_unknown",
        fingerprint: "fp_abc123"
      });

      await service.handlePaymentMethodAttached(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_unknown" });
      expect(paymentMethodRepository.upsert).not.toHaveBeenCalled();
    });

    it("returns early when fingerprint is missing", async () => {
      const { service, userRepository, paymentMethodRepository } = setup();
      const mockUser = createTestUser({ stripeCustomerId: "cus_123" });

      userRepository.findOneBy.mockResolvedValue(mockUser);

      const event = createPaymentMethodAttachedEvent({
        id: "pm_123",
        customer: mockUser.stripeCustomerId!,
        fingerprint: null
      });

      await service.handlePaymentMethodAttached(event);

      expect(paymentMethodRepository.upsert).not.toHaveBeenCalled();
    });
  });

  function setup() {
    const stripeService = mock<StripeService>();
    const refillService = mock<RefillService>();
    const billingConfig = mock<BillingConfigService>();
    const userRepository = mock<UserRepository>();
    const paymentMethodRepository = mock<PaymentMethodRepository>();
    const stripeTransactionRepository = mock<StripeTransactionRepository>();

    // Mock Stripe charges API
    stripeService.charges = {
      retrieve: jest.fn()
    } as unknown as Stripe.ChargesResource;

    const service = new StripeWebhookService(stripeService, refillService, billingConfig, userRepository, paymentMethodRepository, stripeTransactionRepository);

    return {
      service,
      stripeService,
      refillService,
      billingConfig,
      userRepository,
      paymentMethodRepository,
      stripeTransactionRepository
    };
  }

  function createMockTransaction(overrides: Partial<StripeTransactionOutput> = {}): StripeTransactionOutput {
    return {
      id: "tx-123",
      userId: "user-123",
      type: "payment_intent",
      status: "succeeded",
      amount: 10000,
      amountRefunded: 0,
      currency: "usd",
      stripePaymentIntentId: "pi_123",
      stripeChargeId: "ch_123",
      stripeCouponId: null,
      stripePromotionCodeId: null,
      stripeInvoiceId: null,
      paymentMethodType: "card",
      cardBrand: "visa",
      cardLast4: "4242",
      receiptUrl: null,
      description: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  function createPaymentIntentSucceededEvent(paymentIntent: Partial<Stripe.PaymentIntent>): Stripe.PaymentIntentSucceededEvent {
    return {
      id: "evt_123",
      type: "payment_intent.succeeded",
      data: {
        object: paymentIntent as Stripe.PaymentIntent
      }
    } as Stripe.PaymentIntentSucceededEvent;
  }

  function createPaymentIntentFailedEvent(paymentIntent: Partial<Stripe.PaymentIntent>): Stripe.PaymentIntentPaymentFailedEvent {
    return {
      id: "evt_123",
      type: "payment_intent.payment_failed",
      data: {
        object: paymentIntent as Stripe.PaymentIntent
      }
    } as Stripe.PaymentIntentPaymentFailedEvent;
  }

  function createPaymentIntentCanceledEvent(paymentIntent: Partial<Stripe.PaymentIntent>): Stripe.PaymentIntentCanceledEvent {
    return {
      id: "evt_123",
      type: "payment_intent.canceled",
      data: {
        object: paymentIntent as Stripe.PaymentIntent
      }
    } as Stripe.PaymentIntentCanceledEvent;
  }

  function createChargeRefundedEvent(params: { id: string; customer: string | null; amount_refunded: number; refunded: boolean }): Stripe.ChargeRefundedEvent {
    return {
      id: "evt_123",
      type: "charge.refunded",
      data: {
        object: {
          id: params.id,
          customer: params.customer,
          amount_refunded: params.amount_refunded,
          refunded: params.refunded
        } as Stripe.Charge
      }
    } as Stripe.ChargeRefundedEvent;
  }

  function createPaymentMethodAttachedEvent(params: { id: string; customer: string | null; fingerprint: string | null }): Stripe.PaymentMethodAttachedEvent {
    return {
      id: "evt_123",
      type: "payment_method.attached",
      data: {
        object: {
          id: params.id,
          customer: params.customer,
          card: params.fingerprint ? { fingerprint: params.fingerprint } : undefined
        } as Stripe.PaymentMethod
      }
    } as Stripe.PaymentMethodAttachedEvent;
  }
});
