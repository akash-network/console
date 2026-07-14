import type Stripe from "stripe";
import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { FirstPurchaseBonusGranted } from "@src/billing/events/first-purchase-bonus-granted";
import type { PaymentMethodRepository, StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { FirstPurchaseBonusService } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import { StripeWebhookService } from "@src/billing/services/stripe-webhook/stripe-webhook.service";
import type { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
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
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.updateById.mockResolvedValue(undefined);
      refillService.topUpWallet.mockResolvedValue();
      (stripeService.charges.retrieve as Mock).mockResolvedValue({
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
      expect(refillService.topUpWallet).toHaveBeenCalledWith(amount, mockUser.id, {
        endTrial: undefined,
        payment: {
          currency: internalTransaction.currency,
          cardBrand: "visa",
          paymentMethodType: "card",
          transactionId: internalTransaction.id,
          source: "payment_intent"
        }
      });
    });

    it("returns early when customer ID is missing", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const internalTransaction = createMockTransaction({ status: "created" });

      stripeTransactionRepository.findByPaymentIntentId.mockResolvedValue(internalTransaction);

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
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const internalTransaction = createMockTransaction({ status: "created" });

      stripeTransactionRepository.findByPaymentIntentId.mockResolvedValue(internalTransaction);
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
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);

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
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);

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
      expect(refillService.topUpWallet).toHaveBeenCalledWith(amount, mockUser.id, {
        endTrial: undefined,
        payment: {
          currency: internalTransaction.currency,
          cardBrand: undefined,
          paymentMethodType: undefined,
          transactionId: internalTransaction.id,
          source: "payment_intent"
        }
      });
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(
        "tx-123",
        expect.objectContaining({
          status: "succeeded",
          stripePaymentIntentId: "pi_123"
        })
      );
    });

    it("consults the first-purchase bonus service with the locked transaction before flipping its status", async () => {
      const { service, userRepository, stripeTransactionRepository, firstPurchaseBonusService } = setup();
      const mockUser = createTestUser();
      const internalTransaction = createMockTransaction({ status: "created" });
      const amount = 10000;

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findById.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);

      const event = createPaymentIntentSucceededEvent({
        id: "pi_123",
        customer: mockUser.stripeCustomerId,
        amount,
        amount_received: amount,
        metadata: { internal_transaction_id: internalTransaction.id }
      });

      await service.tryToTopUpWalletFromPaymentIntent(event);

      expect(firstPurchaseBonusService.getEligibleBonusAmount).toHaveBeenCalledWith(internalTransaction, amount);
      expect(firstPurchaseBonusService.getEligibleBonusAmount.mock.invocationCallOrder[0]).toBeLessThan(
        stripeTransactionRepository.updateById.mock.invocationCallOrder[0]
      );
    });

    it("tops up the combined amount, persists the bonus and tracks the grant when the bonus applies", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService, firstPurchaseBonusService, domainEventsService } = setup();
      const mockUser = createTestUser();
      const internalTransaction = createMockTransaction({ status: "created" });
      const amount = 15000;
      const bonusAmount = 1500;

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findById.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);
      firstPurchaseBonusService.getEligibleBonusAmount.mockResolvedValue(bonusAmount);

      const event = createPaymentIntentSucceededEvent({
        id: "pi_123",
        customer: mockUser.stripeCustomerId,
        amount,
        amount_received: amount,
        metadata: { internal_transaction_id: internalTransaction.id }
      });

      await service.tryToTopUpWalletFromPaymentIntent(event);

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(
        internalTransaction.id,
        expect.objectContaining({
          status: "succeeded",
          bonusAmount
        })
      );
      expect(refillService.topUpWallet).toHaveBeenCalledWith(amount + bonusAmount, mockUser.id, {
        endTrial: undefined,
        payment: {
          currency: internalTransaction.currency,
          cardBrand: undefined,
          paymentMethodType: undefined,
          transactionId: internalTransaction.id,
          source: "payment_intent",
          bonusAmountCents: bonusAmount
        }
      });
      expect(firstPurchaseBonusService.trackBonusGranted).toHaveBeenCalledWith(mockUser.id, amount, bonusAmount);
      expect(domainEventsService.publish).toHaveBeenCalledWith(
        new FirstPurchaseBonusGranted({ userId: mockUser.id, bonusAmountCents: bonusAmount, paidAmountCents: amount })
      );
      expect(domainEventsService.publish.mock.invocationCallOrder[0]).toBeGreaterThan(refillService.topUpWallet.mock.invocationCallOrder[0]);
    });

    it("keeps the update payload and top-up untouched when no bonus applies", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService, firstPurchaseBonusService, domainEventsService } = setup();
      const mockUser = createTestUser();
      const internalTransaction = createMockTransaction({ status: "created" });
      const amount = 10000;

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findById.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);

      const event = createPaymentIntentSucceededEvent({
        id: "pi_123",
        customer: mockUser.stripeCustomerId,
        amount,
        amount_received: amount,
        metadata: { internal_transaction_id: internalTransaction.id }
      });

      await service.tryToTopUpWalletFromPaymentIntent(event);

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(
        internalTransaction.id,
        expect.not.objectContaining({ bonusAmount: expect.anything() })
      );
      expect(refillService.topUpWallet).toHaveBeenCalledWith(amount, mockUser.id, expect.anything());
      expect(firstPurchaseBonusService.trackBonusGranted).not.toHaveBeenCalled();
      expect(domainEventsService.publish).not.toHaveBeenCalled();
    });
  });

  describe("tryToTopUpWalletFromInvoice", () => {
    it("tops up wallet using transaction amount (not invoice amount_paid which may be 0 for discounted invoices)", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService, stripeService } = setup();
      const mockUser = createTestUser();
      const invoiceId = "in_123";
      const chargeId = "ch_456";
      const paymentIntentId = "pi_789";
      const transactionAmount = 5000;
      const internalTransaction = createMockTransaction({
        id: "tx-inv-1",
        status: "pending",
        type: "coupon_claim",
        amount: transactionAmount,
        stripeInvoiceId: invoiceId
      });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.updateById.mockResolvedValue(undefined);
      refillService.topUpWallet.mockResolvedValue();
      (stripeService.charges.retrieve as Mock).mockResolvedValue({
        id: chargeId,
        payment_method_details: { card: { brand: "mastercard", last4: "5555" } },
        receipt_url: "https://receipt.stripe.com/inv"
      });

      const event = createInvoicePaymentSucceededEvent({
        id: invoiceId,
        customer: mockUser.stripeCustomerId,
        amount_paid: 0,
        payments: {
          object: "list",
          data: [
            {
              payment: {
                charge: chargeId,
                payment_intent: paymentIntentId,
                type: "payment_intent"
              }
            } as Stripe.InvoicePayment
          ],
          has_more: false,
          url: ""
        }
      });

      await service.tryToTopUpWalletFromInvoice(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: mockUser.stripeCustomerId });
      expect(stripeTransactionRepository.findByInvoiceId).toHaveBeenCalledWith(invoiceId);
      expect(stripeService.charges.retrieve).toHaveBeenCalledWith(chargeId);
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(internalTransaction.id, {
        status: "succeeded",
        stripeChargeId: chargeId,
        paymentMethodType: undefined,
        cardBrand: "mastercard",
        cardLast4: "5555",
        receiptUrl: "https://receipt.stripe.com/inv",
        stripePaymentIntentId: paymentIntentId
      });
      // Coupon invoices leave endTrial undefined so RefillService's default (true) ends the trial, like a card purchase.
      expect(refillService.topUpWallet).toHaveBeenCalledWith(transactionAmount, mockUser.id, {
        endTrial: undefined,
        payment: {
          currency: internalTransaction.currency,
          cardBrand: "mastercard",
          paymentMethodType: undefined,
          transactionId: internalTransaction.id,
          source: "coupon_claim"
        }
      });
    });

    it("returns early when customer ID is missing", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const internalTransaction = createMockTransaction({ status: "pending", type: "coupon_claim" });

      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(internalTransaction);

      const event = createInvoicePaymentSucceededEvent({
        id: "in_123",
        customer: null,
        amount_paid: 0
      });

      await service.tryToTopUpWalletFromInvoice(event);

      expect(userRepository.findOneBy).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("returns early when user is not found", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const internalTransaction = createMockTransaction({ status: "pending", type: "coupon_claim" });

      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(internalTransaction);
      userRepository.findOneBy.mockResolvedValue(undefined);

      const event = createInvoicePaymentSucceededEvent({
        id: "in_123",
        customer: "cus_unknown",
        amount_paid: 0
      });

      await service.tryToTopUpWalletFromInvoice(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_unknown" });
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("returns early when transaction is not found", async () => {
      const { service, stripeTransactionRepository, refillService } = setup();

      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(undefined);

      const event = createInvoicePaymentSucceededEvent({
        id: "in_no_match",
        customer: "cus_123",
        amount_paid: 0
      });

      await service.tryToTopUpWalletFromInvoice(event);

      expect(stripeTransactionRepository.findByInvoiceId).toHaveBeenCalledWith("in_no_match");
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("returns early when already processed (idempotency)", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const internalTransaction = createMockTransaction({ id: "tx-inv-2", status: "succeeded", type: "coupon_claim" });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);

      const event = createInvoicePaymentSucceededEvent({
        id: "in_123",
        customer: mockUser.stripeCustomerId,
        amount_paid: 0
      });

      await service.tryToTopUpWalletFromInvoice(event);

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("handles invoice without payments array gracefully", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const transactionAmount = 3000;
      const internalTransaction = createMockTransaction({ id: "tx-inv-3", status: "pending", type: "coupon_claim", amount: transactionAmount });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.updateById.mockResolvedValue(undefined);
      refillService.topUpWallet.mockResolvedValue();

      const event = createInvoicePaymentSucceededEvent({
        id: "in_123",
        customer: mockUser.stripeCustomerId,
        amount_paid: 0
      });

      await service.tryToTopUpWalletFromInvoice(event);

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(internalTransaction.id, {
        status: "succeeded",
        stripeChargeId: undefined,
        paymentMethodType: undefined,
        cardBrand: undefined,
        cardLast4: undefined,
        receiptUrl: undefined,
        stripePaymentIntentId: undefined
      });
      expect(refillService.topUpWallet).toHaveBeenCalledWith(transactionAmount, mockUser.id, {
        endTrial: undefined,
        payment: {
          currency: internalTransaction.currency,
          cardBrand: undefined,
          paymentMethodType: undefined,
          transactionId: internalTransaction.id,
          source: "coupon_claim"
        }
      });
    });

    it("tops up the wallet with endTrial false for a matched manual_credit invoice transaction", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const invoiceId = "in_manual_1";
      const amount = 50000;
      // The admin app pre-creates this row (status pending) before marking the invoice paid
      const transaction = createMockTransaction({
        id: "tx-manual-1",
        type: "manual_credit",
        status: "pending",
        amount,
        stripeInvoiceId: invoiceId
      });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(transaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(transaction);
      stripeTransactionRepository.updateById.mockResolvedValue(undefined);
      refillService.topUpWallet.mockResolvedValue();

      const event = createInvoicePaidEvent({
        id: invoiceId,
        customer: mockUser.stripeCustomerId,
        amount_paid: amount
      });

      await service.tryToTopUpWalletFromInvoice(event);

      expect(stripeTransactionRepository.findByInvoiceId).toHaveBeenCalledWith(invoiceId);
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transaction.id, expect.objectContaining({ status: "succeeded" }));
      // endTrial: false — a granted credit must not graduate a trial user
      expect(refillService.topUpWallet).toHaveBeenCalledWith(amount, mockUser.id, {
        endTrial: false,
        payment: {
          currency: transaction.currency,
          cardBrand: undefined,
          paymentMethodType: undefined,
          transactionId: transaction.id,
          source: "manual_credit"
        }
      });
    });

    it("credits only once when invoice.paid and invoice.payment_succeeded both fire for the same manual_credit invoice", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const invoiceId = "in_manual_dual";
      const amount = 50000;
      const pendingTransaction = createMockTransaction({
        id: "tx-manual-dual",
        type: "manual_credit",
        status: "pending",
        amount,
        stripeInvoiceId: invoiceId
      });
      const succeededTransaction = createMockTransaction({ ...pendingTransaction, status: "succeeded" });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(pendingTransaction);
      // First delivery locks the pending row; second delivery locks an already-succeeded row
      stripeTransactionRepository.findOneByAndLock.mockResolvedValueOnce(pendingTransaction).mockResolvedValueOnce(succeededTransaction);
      stripeTransactionRepository.updateById.mockResolvedValue(undefined);
      refillService.topUpWallet.mockResolvedValue();

      const invoice = { id: invoiceId, customer: mockUser.stripeCustomerId, amount_paid: amount };
      await service.tryToTopUpWalletFromInvoice(createInvoicePaidEvent(invoice));
      await service.tryToTopUpWalletFromInvoice(createInvoicePaymentSucceededEvent(invoice));

      // The already-succeeded guard must credit the wallet exactly once across both event variants
      expect(refillService.topUpWallet).toHaveBeenCalledTimes(1);
      expect(refillService.topUpWallet).toHaveBeenCalledWith(amount, mockUser.id, {
        endTrial: false,
        payment: {
          currency: pendingTransaction.currency,
          cardBrand: undefined,
          paymentMethodType: undefined,
          transactionId: pendingTransaction.id,
          source: "manual_credit"
        }
      });
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledTimes(1);
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(pendingTransaction.id, expect.objectContaining({ status: "succeeded" }));
    });
  });

  describe("routeStripeEvent", () => {
    it.each([
      createInvoicePaidEvent({ id: "in_route", customer: "cus_route", amount_paid: 1000 }),
      createInvoicePaymentSucceededEvent({ id: "in_route", customer: "cus_route", amount_paid: 1000 })
    ])("routes $type events to the invoice top-up handler", async event => {
      const { service, stripeService } = setup();
      stripeService.webhooks = { constructEvent: vi.fn().mockReturnValue(event) } as unknown as Stripe.Webhooks;
      const handler = vi.spyOn(service, "tryToTopUpWalletFromInvoice").mockResolvedValue();

      await service.routeStripeEvent("signature", "raw-body");

      expect(handler).toHaveBeenCalledWith(event);
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
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(createMockTransaction({ id: transactionId, amountRefunded: 0 }));
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
      expect(stripeTransactionRepository.findOneByAndLock).toHaveBeenCalledWith({ stripeChargeId: chargeId });
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transactionId, { amountRefunded: refundedAmount, status: "refunded" });
      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(refundedAmount, mockUser.id, { currency: "usd", transactionId });
    });

    it("calculates refund delta correctly for partial refunds", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const chargeId = "ch_123";
      const transactionId = "tx-123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      // Transaction already has 3000 refunded
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(createMockTransaction({ id: transactionId, amountRefunded: 3000 }));
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
      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(5000, mockUser.id, { currency: "usd", transactionId });
      // Updates amountRefunded but not status since not fully refunded
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transactionId, { amountRefunded: 8000 });
    });

    it("handles duplicate webhook delivery idempotently", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const chargeId = "ch_123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      // Transaction already has this refund processed (amountRefunded matches charge.amount_refunded)
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(createMockTransaction({ id: "tx-123", amountRefunded: 5000 }));

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
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(undefined);

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
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(createMockTransaction({ id: "tx-123", status: "failed" }));

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

    it("claws back the first-purchase bonus on top of a full refund", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const transactionId = "tx-123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(
        createMockTransaction({ id: transactionId, status: "succeeded", amount: 10000, amountRefunded: 0, bonusAmount: 1000 })
      );

      const event = createChargeRefundedEvent({
        id: "ch_123",
        customer: mockUser.stripeCustomerId!,
        amount_refunded: 10000,
        refunded: true
      });

      await service.handleChargeRefunded(event);

      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(11000, mockUser.id, { currency: "usd", transactionId });
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transactionId, { amountRefunded: 10000, status: "refunded" });
    });

    it("does not claw back the bonus again when the transaction is already refunded", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const transactionId = "tx-123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      // Already transitioned to refunded by a previous delivery; a late extra refund only reduces its delta
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(
        createMockTransaction({ id: transactionId, status: "refunded", amount: 10000, amountRefunded: 9000, bonusAmount: 1000 })
      );

      const event = createChargeRefundedEvent({
        id: "ch_123",
        customer: mockUser.stripeCustomerId!,
        amount_refunded: 10000,
        refunded: true
      });

      await service.handleChargeRefunded(event);

      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(1000, mockUser.id, { currency: "usd", transactionId });
    });

    it("leaves the bonus untouched on partial refunds", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const transactionId = "tx-123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(
        createMockTransaction({ id: transactionId, status: "succeeded", amount: 10000, amountRefunded: 0, bonusAmount: 1000 })
      );

      const event = createChargeRefundedEvent({
        id: "ch_123",
        customer: mockUser.stripeCustomerId!,
        amount_refunded: 4000,
        refunded: false
      });

      await service.handleChargeRefunded(event);

      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(4000, mockUser.id, { currency: "usd", transactionId });
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transactionId, { amountRefunded: 4000 });
    });
  });

  describe("handlePaymentMethodAttached", () => {
    it("creates payment method for new card", async () => {
      const { service, userRepository, paymentMethodRepository, stripeService } = setup();
      const mockUser = createTestUser({ stripeCustomerId: "cus_123" });
      const paymentMethodId = "pm_123";
      const fingerprint = "fp_abc123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeService.extractFingerprint.mockReturnValue(fingerprint);
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
        card: { fingerprint }
      });

      await service.handlePaymentMethodAttached(event);

      expect(paymentMethodRepository.upsert).toHaveBeenCalledWith({
        userId: mockUser.id,
        fingerprint,
        paymentMethodId
      });
      expect(stripeService.markRemotePaymentMethodAsDefault).toHaveBeenCalledWith(paymentMethodId, mockUser);
    });

    it("creates payment method for link type", async () => {
      const { service, userRepository, paymentMethodRepository, stripeService } = setup();
      const mockUser = createTestUser({ stripeCustomerId: "cus_123" });
      const paymentMethodId = "pm_link_123";
      const linkFingerprint = "link_abc123hash";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeService.extractFingerprint.mockReturnValue(linkFingerprint);
      paymentMethodRepository.upsert.mockResolvedValue({
        paymentMethod: {
          id: "local-pm-link-123",
          userId: mockUser.id,
          fingerprint: linkFingerprint,
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
        type: "link",
        link: { email: "user@test.com" }
      });

      await service.handlePaymentMethodAttached(event);

      expect(stripeService.extractFingerprint).toHaveBeenCalled();
      expect(paymentMethodRepository.upsert).toHaveBeenCalledWith({
        userId: mockUser.id,
        fingerprint: linkFingerprint,
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
      stripeService.extractFingerprint.mockReturnValue(fingerprint);
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
        card: { fingerprint }
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
      stripeService.extractFingerprint.mockReturnValue(fingerprint);
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
        card: { fingerprint }
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
      stripeService.extractFingerprint.mockReturnValue(fingerprint);
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
        card: { fingerprint }
      });

      // Should not throw
      await expect(service.handlePaymentMethodAttached(event)).resolves.not.toThrow();
    });

    it("returns early when customer ID is missing", async () => {
      const { service, userRepository, paymentMethodRepository } = setup();

      const event = createPaymentMethodAttachedEvent({
        id: "pm_123",
        customer: null,
        card: { fingerprint: "fp_abc123" }
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
        card: { fingerprint: "fp_abc123" }
      });

      await service.handlePaymentMethodAttached(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_unknown" });
      expect(paymentMethodRepository.upsert).not.toHaveBeenCalled();
    });

    it("returns early when fingerprint is missing", async () => {
      const { service, userRepository, paymentMethodRepository, stripeService } = setup();
      const mockUser = createTestUser({ stripeCustomerId: "cus_123" });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeService.extractFingerprint.mockReturnValue(undefined);

      const event = createPaymentMethodAttachedEvent({
        id: "pm_123",
        customer: mockUser.stripeCustomerId!,
        card: { fingerprint: null }
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
    const firstPurchaseBonusService = mock<FirstPurchaseBonusService>();
    firstPurchaseBonusService.getEligibleBonusAmount.mockResolvedValue(0);
    const domainEventsService = mock<DomainEventsService>();

    // Mock Stripe charges API
    stripeService.charges = {
      retrieve: vi.fn()
    } as unknown as Stripe.ChargesResource;

    const service = new StripeWebhookService(
      stripeService,
      refillService,
      billingConfig,
      userRepository,
      paymentMethodRepository,
      stripeTransactionRepository,
      firstPurchaseBonusService,
      domainEventsService
    );

    return {
      service,
      stripeService,
      refillService,
      billingConfig,
      userRepository,
      paymentMethodRepository,
      stripeTransactionRepository,
      firstPurchaseBonusService,
      domainEventsService
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
      bonusAmount: 0,
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

  function createInvoicePaymentSucceededEvent(invoice: Partial<Stripe.Invoice>): Stripe.InvoicePaymentSucceededEvent {
    return {
      id: "evt_123",
      type: "invoice.payment_succeeded",
      data: {
        object: invoice as Stripe.Invoice
      }
    } as Stripe.InvoicePaymentSucceededEvent;
  }

  function createInvoicePaidEvent(invoice: Partial<Stripe.Invoice>): Stripe.InvoicePaidEvent {
    return {
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: invoice as Stripe.Invoice
      }
    } as Stripe.InvoicePaidEvent;
  }

  function createPaymentMethodAttachedEvent(params: {
    id: string;
    customer: string | null;
    type?: string;
    card?: { fingerprint: string | null };
    link?: { email: string };
  }): Stripe.PaymentMethodAttachedEvent {
    return {
      id: "evt_123",
      type: "payment_method.attached",
      data: {
        object: {
          id: params.id,
          customer: params.customer,
          type: params.type ?? "card",
          card: params.card,
          link: params.link
        } as Stripe.PaymentMethod
      }
    } as Stripe.PaymentMethodAttachedEvent;
  }
});
