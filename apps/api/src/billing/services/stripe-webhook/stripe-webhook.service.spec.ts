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

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.updateStatusByPaymentIntentId.mockResolvedValue(undefined);
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
        payment_method_types: ["card"]
      });

      await service.tryToTopUpWalletFromPaymentIntent(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: mockUser.stripeCustomerId });
      expect(stripeService.charges.retrieve).toHaveBeenCalledWith(chargeId);
      expect(stripeTransactionRepository.updateStatusByPaymentIntentId).toHaveBeenCalledWith(paymentIntentId, {
        status: "succeeded",
        stripeChargeId: chargeId,
        paymentMethodType: "card",
        cardBrand: "visa",
        cardLast4: "4242",
        receiptUrl: "https://receipt.url"
      });
      expect(refillService.topUpWallet).toHaveBeenCalledWith(amount, mockUser.id);
    });

    it("returns early when customer ID is missing", async () => {
      const { service, userRepository, refillService } = setup();

      const event = createPaymentIntentSucceededEvent({
        id: "pi_123",
        customer: null,
        amount: 10000
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
        amount: 10000
      });

      await service.tryToTopUpWalletFromPaymentIntent(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_unknown" });
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });
  });

  describe("handlePaymentIntentFailed", () => {
    it("updates transaction status to failed with error message", async () => {
      const { service, stripeTransactionRepository } = setup();
      const paymentIntentId = "pi_123";
      const errorMessage = "Your card was declined.";

      stripeTransactionRepository.updateStatusByPaymentIntentId.mockResolvedValue(undefined);

      const event = createPaymentIntentFailedEvent({
        id: paymentIntentId,
        last_payment_error: { type: "card_error", message: errorMessage } as Stripe.PaymentIntent.LastPaymentError
      });

      await service.handlePaymentIntentFailed(event);

      expect(stripeTransactionRepository.updateStatusByPaymentIntentId).toHaveBeenCalledWith(paymentIntentId, {
        status: "failed",
        errorMessage
      });
    });

    it("uses default error message when none provided", async () => {
      const { service, stripeTransactionRepository } = setup();
      const paymentIntentId = "pi_123";

      stripeTransactionRepository.updateStatusByPaymentIntentId.mockResolvedValue(undefined);

      const event = createPaymentIntentFailedEvent({
        id: paymentIntentId,
        last_payment_error: null
      });

      await service.handlePaymentIntentFailed(event);

      expect(stripeTransactionRepository.updateStatusByPaymentIntentId).toHaveBeenCalledWith(paymentIntentId, {
        status: "failed",
        errorMessage: "Payment failed"
      });
    });
  });

  describe("handlePaymentIntentCanceled", () => {
    it("updates transaction status to canceled", async () => {
      const { service, stripeTransactionRepository } = setup();
      const paymentIntentId = "pi_123";

      stripeTransactionRepository.updateStatusByPaymentIntentId.mockResolvedValue(undefined);

      const event = createPaymentIntentCanceledEvent({ id: paymentIntentId });

      await service.handlePaymentIntentCanceled(event);

      expect(stripeTransactionRepository.updateStatusByPaymentIntentId).toHaveBeenCalledWith(paymentIntentId, {
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
      stripeTransactionRepository.findByChargeId.mockResolvedValue(createMockTransaction({ id: transactionId }));
      stripeTransactionRepository.updateById.mockResolvedValue(undefined);
      refillService.reduceWalletBalance.mockResolvedValue();

      const event = createChargeRefundedEvent({
        id: chargeId,
        customer: mockUser.stripeCustomerId!,
        amount_refunded: refundedAmount,
        refunded: true,
        previous_amount_refunded: 0
      });

      await service.handleChargeRefunded(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: mockUser.stripeCustomerId });
      expect(stripeTransactionRepository.findByChargeId).toHaveBeenCalledWith(chargeId);
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transactionId, { status: "refunded" });
      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(refundedAmount, mockUser.id);
    });

    it("calculates refund delta correctly for partial refunds", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const chargeId = "ch_123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByChargeId.mockResolvedValue(createMockTransaction({ id: "tx-123" }));
      refillService.reduceWalletBalance.mockResolvedValue();

      // Second partial refund: total is now 8000, previously was 3000, so delta is 5000
      const event = createChargeRefundedEvent({
        id: chargeId,
        customer: mockUser.stripeCustomerId!,
        amount_refunded: 8000,
        refunded: false, // Not fully refunded
        previous_amount_refunded: 3000
      });

      await service.handleChargeRefunded(event);

      // Uses delta (8000 - 3000 = 5000), not cumulative (8000)
      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(5000, mockUser.id);
      // Does not update to "refunded" since not fully refunded
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
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

    it("returns early when refund delta is zero", async () => {
      const { service, userRepository, refillService } = setup();

      const event = createChargeRefundedEvent({
        id: "ch_123",
        customer: "cus_123",
        amount_refunded: 5000,
        refunded: true,
        previous_amount_refunded: 5000 // Same as current, delta is 0
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
        refunded: true,
        previous_amount_refunded: 0
      });

      await service.handleChargeRefunded(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_unknown" });
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("logs warning when transaction is not found but still reduces balance", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByChargeId.mockResolvedValue(undefined);
      refillService.reduceWalletBalance.mockResolvedValue();

      const event = createChargeRefundedEvent({
        id: "ch_123",
        customer: mockUser.stripeCustomerId!,
        amount_refunded: 5000,
        refunded: true,
        previous_amount_refunded: 0
      });

      await service.handleChargeRefunded(event);

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(5000, mockUser.id);
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

  function createChargeRefundedEvent(params: {
    id: string;
    customer: string | null;
    amount_refunded: number;
    refunded: boolean;
    previous_amount_refunded?: number;
  }): Stripe.ChargeRefundedEvent {
    return {
      id: "evt_123",
      type: "charge.refunded",
      data: {
        object: {
          id: params.id,
          customer: params.customer,
          amount_refunded: params.amount_refunded,
          refunded: params.refunded
        } as Stripe.Charge,
        previous_attributes: {
          amount_refunded: params.previous_amount_refunded ?? 0
        }
      }
    } as Stripe.ChargeRefundedEvent;
  }
});
