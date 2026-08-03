import type { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeTransactionRepository } from "@src/billing/repositories";
import type { FirstPurchaseBonusService } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import type { TimerService } from "@src/core/services/timer/timer.service";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import { StripeTransactionService } from "./stripe-transaction.service";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createTestUser } from "@test/seeders/user-test.seeder";

/**
 * These cover the webhook-facing settlement/refund methods, which route through `@WithTransaction`
 * writers that open a real DB transaction and so can't run as unit specs — they live here (DB-backed
 * `integration` project). The repositories are still mocked; only the transaction wrapper needs the
 * database.
 */
describe(StripeTransactionService.name, () => {
  describe("settlePaymentIntent", () => {
    it("tops up wallet and updates transaction on successful payment", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService, stripe } = setup();
      const mockUser = createTestUser();
      const chargeId = "ch_123";
      const paymentIntentId = "pi_123";
      const amount = 10000;
      const internalTransaction = generateDatabaseStripeTransaction({ id: "tx-123", type: "payment_intent", status: "created", amount, currency: "usd" });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findById.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);
      refillService.topUpWallet.mockResolvedValue();
      vi.spyOn(stripe.charges, "retrieve").mockResolvedValue(
        mock<Stripe.Response<Stripe.Charge>>({
          id: chargeId,
          payment_method_details: { card: { brand: "visa", last4: "4242" } },
          receipt_url: "https://receipt.url"
        })
      );

      const event = createPaymentIntentSucceededEvent({
        id: paymentIntentId,
        customer: mockUser.stripeCustomerId,
        amount,
        amount_received: amount,
        latest_charge: chargeId,
        payment_method_types: ["card"],
        metadata: { internal_transaction_id: internalTransaction.id }
      });

      await service.settlePaymentIntent(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: mockUser.stripeCustomerId });
      expect(stripe.charges.retrieve).toHaveBeenCalledWith(chargeId);
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
      stripeTransactionRepository.findByPaymentIntentId.mockResolvedValue(generateDatabaseStripeTransaction({ status: "created" }));

      await service.settlePaymentIntent(createPaymentIntentSucceededEvent({ id: "pi_123", customer: null, amount: 10000, metadata: {} }));

      expect(userRepository.findOneBy).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("returns early when user is not found", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      stripeTransactionRepository.findByPaymentIntentId.mockResolvedValue(generateDatabaseStripeTransaction({ status: "created" }));
      userRepository.findOneBy.mockResolvedValue(undefined);

      await service.settlePaymentIntent(createPaymentIntentSucceededEvent({ id: "pi_123", customer: "cus_unknown", amount: 10000, metadata: {} }));

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_unknown" });
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("returns early when payment was already processed (idempotency)", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const internalTransaction = generateDatabaseStripeTransaction({ id: "tx-123", status: "succeeded" });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findById.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);

      await service.settlePaymentIntent(
        createPaymentIntentSucceededEvent({
          id: "pi_123",
          customer: mockUser.stripeCustomerId,
          amount: 10000,
          metadata: { internal_transaction_id: internalTransaction.id }
        })
      );

      expect(stripeTransactionRepository.findById).toHaveBeenCalledWith(internalTransaction.id);
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
    });

    it("skips a payment-method validation intent without touching the transaction", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();

      await service.settlePaymentIntent(
        createPaymentIntentSucceededEvent({ id: "pi_123", customer: "cus_123", amount: 10000, metadata: { type: "payment_method_validation" } })
      );

      expect(stripeTransactionRepository.findById).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.findByPaymentIntentId).not.toHaveBeenCalled();
      expect(userRepository.findOneBy).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("throws when no transaction can be matched to the payment intent", async () => {
      const { service, stripeTransactionRepository } = setup();
      stripeTransactionRepository.findByPaymentIntentId.mockResolvedValue(undefined);

      await expect(
        service.settlePaymentIntent(createPaymentIntentSucceededEvent({ id: "pi_123", customer: "cus_123", amount: 10000, metadata: {} }))
      ).rejects.toMatchObject({ status: 500 });
    });

    it("consults the first-purchase bonus service with the locked transaction before flipping its status", async () => {
      const { service, userRepository, stripeTransactionRepository, firstPurchaseBonusService } = setup();
      const mockUser = createTestUser();
      const internalTransaction = generateDatabaseStripeTransaction({ status: "created" });
      const amount = 10000;

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findById.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);

      await service.settlePaymentIntent(
        createPaymentIntentSucceededEvent({
          id: "pi_123",
          customer: mockUser.stripeCustomerId,
          amount,
          amount_received: amount,
          metadata: { internal_transaction_id: internalTransaction.id }
        })
      );

      expect(firstPurchaseBonusService.getEligibleBonusAmount).toHaveBeenCalledWith(internalTransaction, amount);
      expect(firstPurchaseBonusService.getEligibleBonusAmount.mock.invocationCallOrder[0]).toBeLessThan(
        stripeTransactionRepository.updateById.mock.invocationCallOrder[0]
      );
    });

    it("tops up the combined amount, persists the bonus and returns the grant when the bonus applies", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService, firstPurchaseBonusService } = setup();
      const mockUser = createTestUser();
      const internalTransaction = generateDatabaseStripeTransaction({ status: "created" });
      const amount = 15000;
      const bonusAmount = 1500;

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findById.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);
      firstPurchaseBonusService.getEligibleBonusAmount.mockResolvedValue(bonusAmount);

      const grant = await service.settlePaymentIntent(
        createPaymentIntentSucceededEvent({
          id: "pi_123",
          customer: mockUser.stripeCustomerId,
          amount,
          amount_received: amount,
          metadata: { internal_transaction_id: internalTransaction.id }
        })
      );

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(
        internalTransaction.id,
        expect.objectContaining({ status: "succeeded", bonusAmount })
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
      expect(grant).toEqual({ userId: mockUser.id, bonusAmountCents: bonusAmount, paidAmountCents: amount });
    });

    it("returns undefined and keeps the top-up untouched when no bonus applies", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService, firstPurchaseBonusService } = setup();
      const mockUser = createTestUser();
      const internalTransaction = generateDatabaseStripeTransaction({ status: "created" });
      const amount = 10000;

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findById.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);

      const grant = await service.settlePaymentIntent(
        createPaymentIntentSucceededEvent({
          id: "pi_123",
          customer: mockUser.stripeCustomerId,
          amount,
          amount_received: amount,
          metadata: { internal_transaction_id: internalTransaction.id }
        })
      );

      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(
        internalTransaction.id,
        expect.not.objectContaining({ bonusAmount: expect.anything() })
      );
      expect(refillService.topUpWallet).toHaveBeenCalledWith(amount, mockUser.id, expect.anything());
      expect(firstPurchaseBonusService.trackBonusGranted).not.toHaveBeenCalled();
      expect(grant).toBeUndefined();
    });
  });

  describe("settleInvoice", () => {
    it("tops up wallet using transaction amount (not invoice amount_paid which may be 0 for discounted invoices)", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService, stripe } = setup();
      const mockUser = createTestUser();
      const invoiceId = "in_123";
      const chargeId = "ch_456";
      const paymentIntentId = "pi_789";
      const transactionAmount = 5000;
      const internalTransaction = generateDatabaseStripeTransaction({
        id: "tx-inv-1",
        status: "pending",
        type: "coupon_claim",
        amount: transactionAmount,
        stripeInvoiceId: invoiceId
      });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);
      refillService.topUpWallet.mockResolvedValue();
      vi.spyOn(stripe.charges, "retrieve").mockResolvedValue(
        mock<Stripe.Response<Stripe.Charge>>({
          id: chargeId,
          payment_method_details: { card: { brand: "mastercard", last4: "5555" } },
          receipt_url: "https://receipt.stripe.com/inv"
        })
      );

      const event = createInvoicePaymentSucceededEvent({
        id: invoiceId,
        customer: mockUser.stripeCustomerId,
        amount_paid: 0,
        payments: {
          object: "list",
          data: [{ payment: { charge: chargeId, payment_intent: paymentIntentId, type: "payment_intent" } } as Stripe.InvoicePayment],
          has_more: false,
          url: ""
        }
      });

      await service.settleInvoice(event);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: mockUser.stripeCustomerId });
      expect(stripeTransactionRepository.findByInvoiceId).toHaveBeenCalledWith(invoiceId);
      expect(stripe.charges.retrieve).toHaveBeenCalledWith(chargeId);
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(internalTransaction.id, {
        status: "succeeded",
        stripeChargeId: chargeId,
        paymentMethodType: undefined,
        cardBrand: "mastercard",
        cardLast4: "5555",
        receiptUrl: "https://receipt.stripe.com/inv",
        stripePaymentIntentId: paymentIntentId
      });
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
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(generateDatabaseStripeTransaction({ status: "pending", type: "coupon_claim" }));

      await service.settleInvoice(createInvoicePaymentSucceededEvent({ id: "in_123", customer: null, amount_paid: 0 }));

      expect(userRepository.findOneBy).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("returns early when user is not found", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(generateDatabaseStripeTransaction({ status: "pending", type: "coupon_claim" }));
      userRepository.findOneBy.mockResolvedValue(undefined);

      await service.settleInvoice(createInvoicePaymentSucceededEvent({ id: "in_123", customer: "cus_unknown", amount_paid: 0 }));

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_unknown" });
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("returns early when transaction is not found", async () => {
      const { service, stripeTransactionRepository, refillService } = setup();
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(undefined);

      await service.settleInvoice(createInvoicePaymentSucceededEvent({ id: "in_no_match", customer: "cus_123", amount_paid: 0 }));

      expect(stripeTransactionRepository.findByInvoiceId).toHaveBeenCalledWith("in_no_match");
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("returns early when already processed (idempotency)", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const internalTransaction = generateDatabaseStripeTransaction({ id: "tx-inv-2", status: "succeeded", type: "coupon_claim" });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);

      await service.settleInvoice(createInvoicePaymentSucceededEvent({ id: "in_123", customer: mockUser.stripeCustomerId, amount_paid: 0 }));

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("handles invoice without payments array gracefully", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const transactionAmount = 3000;
      const internalTransaction = generateDatabaseStripeTransaction({ id: "tx-inv-3", status: "pending", type: "coupon_claim", amount: transactionAmount });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(internalTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(internalTransaction);
      refillService.topUpWallet.mockResolvedValue();

      await service.settleInvoice(createInvoicePaymentSucceededEvent({ id: "in_123", customer: mockUser.stripeCustomerId, amount_paid: 0 }));

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
      const transaction = generateDatabaseStripeTransaction({
        id: "tx-manual-1",
        type: "manual_credit",
        status: "pending",
        amount,
        stripeInvoiceId: invoiceId
      });

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(transaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(transaction);
      refillService.topUpWallet.mockResolvedValue();

      await service.settleInvoice(createInvoicePaidEvent({ id: invoiceId, customer: mockUser.stripeCustomerId, amount_paid: amount }));

      expect(stripeTransactionRepository.findByInvoiceId).toHaveBeenCalledWith(invoiceId);
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transaction.id, expect.objectContaining({ status: "succeeded" }));
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
      const pendingTransaction = generateDatabaseStripeTransaction({
        id: "tx-manual-dual",
        type: "manual_credit",
        status: "pending",
        amount,
        stripeInvoiceId: invoiceId
      });
      const succeededTransaction = { ...pendingTransaction, status: "succeeded" as const };

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findByInvoiceId.mockResolvedValue(pendingTransaction);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValueOnce(pendingTransaction).mockResolvedValueOnce(succeededTransaction);
      refillService.topUpWallet.mockResolvedValue();

      const invoice = { id: invoiceId, customer: mockUser.stripeCustomerId, amount_paid: amount };
      await service.settleInvoice(createInvoicePaidEvent(invoice));
      await service.settleInvoice(createInvoicePaymentSucceededEvent(invoice));

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

  describe("failPaymentIntent", () => {
    it("updates transaction status to failed with error message", async () => {
      const { service, stripeTransactionRepository } = setup();
      const errorMessage = "Your card was declined.";

      await service.failPaymentIntent(
        createPaymentIntentFailedEvent({
          id: "pi_123",
          last_payment_error: { type: "card_error", message: errorMessage } as Stripe.PaymentIntent.LastPaymentError
        })
      );

      expect(stripeTransactionRepository.updateByPaymentIntentId).toHaveBeenCalledWith("pi_123", { status: "failed", errorMessage });
    });

    it("uses default error message when none provided", async () => {
      const { service, stripeTransactionRepository } = setup();

      await service.failPaymentIntent(createPaymentIntentFailedEvent({ id: "pi_123", last_payment_error: null }));

      expect(stripeTransactionRepository.updateByPaymentIntentId).toHaveBeenCalledWith("pi_123", { status: "failed", errorMessage: "Payment failed" });
    });
  });

  describe("cancelPaymentIntent", () => {
    it("updates transaction status to canceled", async () => {
      const { service, stripeTransactionRepository } = setup();

      await service.cancelPaymentIntent(createPaymentIntentCanceledEvent({ id: "pi_123" }));

      expect(stripeTransactionRepository.updateByPaymentIntentId).toHaveBeenCalledWith("pi_123", { status: "canceled" });
    });
  });

  describe("refundCharge", () => {
    it("reduces wallet balance and updates transaction on full refund", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const chargeId = "ch_123";
      const transactionId = "tx-123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(
        generateDatabaseStripeTransaction({ id: transactionId, status: "succeeded", amountRefunded: 0 })
      );
      refillService.reduceWalletBalance.mockResolvedValue();

      await service.refundCharge(createChargeRefundedEvent({ id: chargeId, customer: mockUser.stripeCustomerId!, amount_refunded: 5000, refunded: true }));

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: mockUser.stripeCustomerId });
      expect(stripeTransactionRepository.findOneByAndLock).toHaveBeenCalledWith({ stripeChargeId: chargeId });
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transactionId, { amountRefunded: 5000, status: "refunded" });
      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(5000, mockUser.id, { currency: "usd", transactionId });
    });

    it("calculates refund delta correctly for partial refunds", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const transactionId = "tx-123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(
        generateDatabaseStripeTransaction({ id: transactionId, status: "succeeded", amountRefunded: 3000 })
      );
      refillService.reduceWalletBalance.mockResolvedValue();

      await service.refundCharge(createChargeRefundedEvent({ id: "ch_123", customer: mockUser.stripeCustomerId!, amount_refunded: 8000, refunded: false }));

      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(5000, mockUser.id, { currency: "usd", transactionId });
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transactionId, { amountRefunded: 8000 });
    });

    it("handles duplicate webhook delivery idempotently", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(
        generateDatabaseStripeTransaction({ id: "tx-123", status: "succeeded", amountRefunded: 5000 })
      );

      await service.refundCharge(createChargeRefundedEvent({ id: "ch_123", customer: mockUser.stripeCustomerId!, amount_refunded: 5000, refunded: true }));

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("returns early when customer ID is missing", async () => {
      const { service, userRepository, refillService } = setup();

      await service.refundCharge(createChargeRefundedEvent({ id: "ch_123", customer: null, amount_refunded: 5000, refunded: true }));

      expect(userRepository.findOneBy).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("returns early when user is not found", async () => {
      const { service, userRepository, refillService } = setup();
      userRepository.findOneBy.mockResolvedValue(undefined);

      await service.refundCharge(createChargeRefundedEvent({ id: "ch_123", customer: "cus_unknown", amount_refunded: 5000, refunded: true }));

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_unknown" });
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("returns early when transaction is not found", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(undefined);

      await service.refundCharge(createChargeRefundedEvent({ id: "ch_123", customer: mockUser.stripeCustomerId!, amount_refunded: 5000, refunded: true }));

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("returns early when transaction is not in succeeded state", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(generateDatabaseStripeTransaction({ id: "tx-123", status: "failed" }));

      await service.refundCharge(createChargeRefundedEvent({ id: "ch_123", customer: mockUser.stripeCustomerId!, amount_refunded: 5000, refunded: true }));

      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
      expect(refillService.reduceWalletBalance).not.toHaveBeenCalled();
    });

    it("claws back the first-purchase bonus on top of a full refund", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const transactionId = "tx-123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(
        generateDatabaseStripeTransaction({ id: transactionId, status: "succeeded", amount: 10000, amountRefunded: 0, bonusAmount: 1000 })
      );

      await service.refundCharge(createChargeRefundedEvent({ id: "ch_123", customer: mockUser.stripeCustomerId!, amount_refunded: 10000, refunded: true }));

      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(11000, mockUser.id, { currency: "usd", transactionId });
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transactionId, { amountRefunded: 10000, status: "refunded" });
    });

    it("does not claw back the bonus again when the transaction is already refunded", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const transactionId = "tx-123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(
        generateDatabaseStripeTransaction({ id: transactionId, status: "refunded", amount: 10000, amountRefunded: 9000, bonusAmount: 1000 })
      );

      await service.refundCharge(createChargeRefundedEvent({ id: "ch_123", customer: mockUser.stripeCustomerId!, amount_refunded: 10000, refunded: true }));

      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(1000, mockUser.id, { currency: "usd", transactionId });
    });

    it("leaves the bonus untouched on partial refunds", async () => {
      const { service, userRepository, stripeTransactionRepository, refillService } = setup();
      const mockUser = createTestUser();
      const transactionId = "tx-123";

      userRepository.findOneBy.mockResolvedValue(mockUser);
      stripeTransactionRepository.findOneByAndLock.mockResolvedValue(
        generateDatabaseStripeTransaction({ id: transactionId, status: "succeeded", amount: 10000, amountRefunded: 0, bonusAmount: 1000 })
      );

      await service.refundCharge(createChargeRefundedEvent({ id: "ch_123", customer: mockUser.stripeCustomerId!, amount_refunded: 4000, refunded: false }));

      expect(refillService.reduceWalletBalance).toHaveBeenCalledWith(4000, mockUser.id, { currency: "usd", transactionId });
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transactionId, { amountRefunded: 4000 });
    });
  });

  function setup() {
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    const refillService = mock<RefillService>();
    const firstPurchaseBonusService = mock<FirstPurchaseBonusService>();
    firstPurchaseBonusService.getEligibleBonusAmount.mockResolvedValue(0);
    const userRepository = mock<UserRepository>();

    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });

    const service = new StripeTransactionService(
      stripe,
      stripeTransactionRepository,
      refillService,
      firstPurchaseBonusService,
      mock<TimerService>(),
      userRepository,
      () => mock<LoggerService>()
    );

    return { service, stripe, stripeTransactionRepository, refillService, firstPurchaseBonusService, userRepository };
  }

  function createPaymentIntentSucceededEvent(paymentIntent: Partial<Stripe.PaymentIntent>): Stripe.PaymentIntentSucceededEvent {
    return {
      id: "evt_123",
      type: "payment_intent.succeeded",
      data: { object: paymentIntent as Stripe.PaymentIntent }
    } as Stripe.PaymentIntentSucceededEvent;
  }

  function createPaymentIntentFailedEvent(paymentIntent: Partial<Stripe.PaymentIntent>): Stripe.PaymentIntentPaymentFailedEvent {
    return {
      id: "evt_123",
      type: "payment_intent.payment_failed",
      data: { object: paymentIntent as Stripe.PaymentIntent }
    } as Stripe.PaymentIntentPaymentFailedEvent;
  }

  function createPaymentIntentCanceledEvent(paymentIntent: Partial<Stripe.PaymentIntent>): Stripe.PaymentIntentCanceledEvent {
    return {
      id: "evt_123",
      type: "payment_intent.canceled",
      data: { object: paymentIntent as Stripe.PaymentIntent }
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
      data: { object: invoice as Stripe.Invoice }
    } as Stripe.InvoicePaymentSucceededEvent;
  }

  function createInvoicePaidEvent(invoice: Partial<Stripe.Invoice>): Stripe.InvoicePaidEvent {
    return {
      id: "evt_123",
      type: "invoice.paid",
      data: { object: invoice as Stripe.Invoice }
    } as Stripe.InvoicePaidEvent;
  }
});
