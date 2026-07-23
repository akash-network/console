import { faker } from "@faker-js/faker";
import type Stripe from "stripe";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { PayingUser } from "@src/billing/services/paying-user/paying-user";
import type { PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import { type PaymentMethod } from "@src/billing/services/payment-method/payment-method.service";
import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import type { StripeErrorService } from "@src/billing/services/stripe-error/stripe-error.service";
import type { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import type { TransactionReportingService } from "@src/billing/services/transaction-reporting/transaction-reporting.service";
import type { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import { StripeController } from "./stripe.controller";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(StripeController.name, () => {
  describe("confirmPayment", () => {
    it("returns transactionId and transactionStatus on successful payment", async () => {
      const { controller, stripeTransaction, paymentMethodService, user } = setup();
      const transactionId = faker.string.uuid();

      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransaction.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId,
        transactionStatus: "pending"
      });

      const result = await controller.confirmPayment({
        userId: user.id,
        paymentMethodId: faker.string.uuid(),
        amount: 100
      });

      expect(result).toEqual({
        data: {
          success: true,
          transactionId,
          transactionStatus: "pending"
        }
      });
    });

    it("resolves transaction when awaitResolved is true", async () => {
      const { controller, stripeTransaction, paymentMethodService, user } = setup();
      const transactionId = faker.string.uuid();
      const resolvedTransaction = generateDatabaseStripeTransaction({ id: transactionId, status: "succeeded" });

      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransaction.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId,
        transactionStatus: "pending"
      });
      stripeTransaction.resolveTransaction.mockResolvedValue(resolvedTransaction);

      const result = await controller.confirmPayment({
        userId: user.id,
        paymentMethodId: faker.string.uuid(),
        amount: 100,
        awaitResolved: true
      });

      expect(stripeTransaction.resolveTransaction).toHaveBeenCalledWith(transactionId);
      expect(result).toEqual({
        data: {
          success: true,
          transactionId,
          transactionStatus: "succeeded"
        }
      });
    });

    it("invokes trial-min validation before contacting Stripe", async () => {
      const { controller, stripeTransaction, userWalletRepository, trialValidationService, paymentMethodService, user } = setup();
      const wallet = mock<UserWalletOutput>({ isTrialing: true });
      userWalletRepository.findOneByUserId.mockResolvedValue(wallet);
      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransaction.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId: faker.string.uuid(),
        transactionStatus: "pending"
      });

      await controller.confirmPayment({
        userId: user.id,
        paymentMethodId: faker.string.uuid(),
        amount: 100
      });

      expect(trialValidationService.validateTopUpAmount).toHaveBeenCalledWith(wallet, 100);
    });

    it("propagates the trial-min rejection without ever calling Stripe", async () => {
      const { controller, stripeTransaction, userWalletRepository, trialValidationService, paymentMethodService, user } = setup();
      const wallet = mock<UserWalletOutput>({ isTrialing: true });
      userWalletRepository.findOneByUserId.mockResolvedValue(wallet);
      const trialError = Object.assign(new Error("First top-up must be at least $100 while on the free trial."), { status: 402 });
      trialValidationService.validateTopUpAmount.mockImplementation(() => {
        throw trialError;
      });

      await expect(
        controller.confirmPayment({
          userId: user.id,
          paymentMethodId: faker.string.uuid(),
          amount: 50
        })
      ).rejects.toBe(trialError);
      expect(paymentMethodService.hasPaymentMethod).not.toHaveBeenCalled();
      expect(stripeTransaction.createPaymentIntent).not.toHaveBeenCalled();
    });

    it("forwards an undefined wallet to trial-min validation when no wallet exists", async () => {
      const { controller, stripeTransaction, userWalletRepository, trialValidationService, paymentMethodService, user } = setup();
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);
      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransaction.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId: faker.string.uuid(),
        transactionStatus: "pending"
      });

      await controller.confirmPayment({
        userId: user.id,
        paymentMethodId: faker.string.uuid(),
        amount: 50
      });

      expect(trialValidationService.validateTopUpAmount).toHaveBeenCalledWith(undefined, 50);
    });

    it("returns 3DS data with transactionId and transactionStatus", async () => {
      const { controller, stripeTransaction, paymentMethodService, user } = setup();
      const transactionId = faker.string.uuid();
      const paymentIntentId = faker.string.uuid();
      const clientSecret = faker.string.alphanumeric(32);

      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransaction.createPaymentIntent.mockResolvedValue({
        success: false,
        requiresAction: true,
        clientSecret,
        paymentIntentId,
        transactionId,
        transactionStatus: "requires_action"
      });

      const result = await controller.confirmPayment({
        userId: user.id,
        paymentMethodId: faker.string.uuid(),
        amount: 100
      });

      expect(result).toEqual({
        data: {
          success: false,
          requiresAction: true,
          clientSecret,
          paymentIntentId,
          transactionId,
          transactionStatus: "requires_action"
        }
      });
    });

    it("namespaces the client attempt key with the user id before calling Stripe", async () => {
      const { controller, stripeTransaction, paymentMethodService, user } = setup();
      const clientKey = faker.string.uuid();

      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransaction.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId: faker.string.uuid(),
        transactionStatus: "pending"
      });

      await controller.confirmPayment({
        userId: user.id,
        paymentMethodId: faker.string.uuid(),
        amount: 100,
        idempotencyKey: clientKey
      });

      expect(stripeTransaction.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: `topup_${user.id}_${clientKey}` }));
    });

    it("passes no idempotency key to Stripe when the client sends none", async () => {
      const { controller, stripeTransaction, paymentMethodService, user } = setup();

      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransaction.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId: faker.string.uuid(),
        transactionStatus: "pending"
      });

      await controller.confirmPayment({
        userId: user.id,
        paymentMethodId: faker.string.uuid(),
        amount: 100
      });

      expect(stripeTransaction.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: undefined }));
    });
  });

  describe("createSetupIntent", () => {
    it("passes isFreeTrial true when user wallet is trialing", async () => {
      const { controller, stripe, userWalletRepository, user } = setup();
      const clientSecret = faker.string.alphanumeric(32);

      userWalletRepository.findOneByUserId.mockResolvedValue(mock<UserWalletOutput>({ isTrialing: true }));
      stripe.getStripeCustomerId.mockResolvedValue(user.stripeCustomerId!);
      stripe.createSetupIntent.mockResolvedValue(mock<Stripe.Response<Stripe.SetupIntent>>({ client_secret: clientSecret }));

      const result = await controller.createSetupIntent();

      expect(stripe.createSetupIntent).toHaveBeenCalledWith(user.stripeCustomerId, { isFreeTrial: true });
      expect(result).toEqual({ data: { clientSecret } });
    });

    it("passes isFreeTrial false when user wallet is not trialing", async () => {
      const { controller, stripe, userWalletRepository, user } = setup();
      const clientSecret = faker.string.alphanumeric(32);

      userWalletRepository.findOneByUserId.mockResolvedValue(mock<UserWalletOutput>({ isTrialing: false }));
      stripe.getStripeCustomerId.mockResolvedValue(user.stripeCustomerId!);
      stripe.createSetupIntent.mockResolvedValue(mock<Stripe.Response<Stripe.SetupIntent>>({ client_secret: clientSecret }));

      const result = await controller.createSetupIntent();

      expect(stripe.createSetupIntent).toHaveBeenCalledWith(user.stripeCustomerId, { isFreeTrial: false });
      expect(result).toEqual({ data: { clientSecret } });
    });

    it("defaults isFreeTrial to true when no wallet exists", async () => {
      const { controller, stripe, userWalletRepository, user } = setup();
      const clientSecret = faker.string.alphanumeric(32);

      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);
      stripe.getStripeCustomerId.mockResolvedValue(user.stripeCustomerId!);
      stripe.createSetupIntent.mockResolvedValue(mock<Stripe.Response<Stripe.SetupIntent>>({ client_secret: clientSecret }));

      const result = await controller.createSetupIntent();

      expect(stripe.createSetupIntent).toHaveBeenCalledWith(user.stripeCustomerId, { isFreeTrial: true });
      expect(result).toEqual({ data: { clientSecret } });
    });
  });

  describe("applyCoupon", () => {
    it("returns transactionId and transactionStatus on successful coupon", async () => {
      const { controller, stripe, user } = setup();
      const transactionId = faker.string.uuid();
      const mockCoupon = mock<Stripe.Coupon>({ id: faker.string.uuid() });

      stripe.applyCoupon.mockResolvedValue({
        coupon: mockCoupon,
        amountAdded: 10,
        transactionId,
        transactionStatus: "pending"
      });

      const result = await controller.applyCoupon({
        couponId: faker.string.alphanumeric(10),
        userId: user.id
      });

      expect(result).toEqual({
        data: {
          coupon: mockCoupon,
          amountAdded: 10,
          transactionId,
          transactionStatus: "pending"
        }
      });
    });

    it("resolves transaction when awaitResolved is true", async () => {
      const { controller, stripe, stripeTransaction, user } = setup();
      const transactionId = faker.string.uuid();
      const mockCoupon = mock<Stripe.Coupon>({ id: faker.string.uuid() });
      const resolvedTransaction = generateDatabaseStripeTransaction({ id: transactionId, status: "succeeded" });

      stripe.applyCoupon.mockResolvedValue({
        coupon: mockCoupon,
        amountAdded: 10,
        transactionId,
        transactionStatus: "pending"
      });
      stripeTransaction.resolveTransaction.mockResolvedValue(resolvedTransaction);

      const result = await controller.applyCoupon({
        couponId: faker.string.alphanumeric(10),
        userId: user.id,
        awaitResolved: true
      });

      expect(stripeTransaction.resolveTransaction).toHaveBeenCalledWith(transactionId);
      expect(result).toEqual({
        data: {
          coupon: mockCoupon,
          amountAdded: 10,
          transactionId,
          transactionStatus: "succeeded"
        }
      });
    });
  });

  describe("removePaymentMethod", () => {
    it("detaches the payment method without checking trial status", async () => {
      const { controller, stripe, userWalletRepository, user } = setup();
      const paymentMethodId = faker.string.uuid();
      stripe.retrievePaymentMethod.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: user.stripeCustomerId }));

      await controller.removePaymentMethod(paymentMethodId);

      expect(stripe.detachPaymentMethod).toHaveBeenCalledWith(paymentMethodId);
      expect(userWalletRepository.findOneByUserId).not.toHaveBeenCalled();
    });

    it("rejects when the payment method does not belong to the user", async () => {
      const { controller, stripe } = setup();
      const paymentMethodId = faker.string.uuid();
      stripe.retrievePaymentMethod.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: "cus_someoneelse" }));

      await expect(controller.removePaymentMethod(paymentMethodId)).rejects.toMatchObject({ status: 403 });
      expect(stripe.detachPaymentMethod).not.toHaveBeenCalled();
    });
  });

  describe("getDefaultPaymentMethod", () => {
    it("returns the default payment method for the current paying user", async () => {
      const { controller, paymentMethodService } = setup();
      const paymentMethod = mock<PaymentMethod>({ id: faker.string.uuid(), isDefault: true });
      paymentMethodService.getDefaultPaymentMethod.mockResolvedValue(paymentMethod);

      const result = await controller.getDefaultPaymentMethod();

      expect(result).toEqual({ data: paymentMethod });
    });

    it("throws 404 when the current user has no Stripe customer", async () => {
      const { controller, authService, paymentMethodService } = setup();
      authService.getCurrentPayingUser.mockReturnValue(undefined as unknown as PayingUser);

      await expect(controller.getDefaultPaymentMethod()).rejects.toMatchObject({ status: 404 });
      expect(paymentMethodService.getDefaultPaymentMethod).not.toHaveBeenCalled();
    });

    it("throws 404 when no default payment method exists", async () => {
      const { controller, paymentMethodService } = setup();
      paymentMethodService.getDefaultPaymentMethod.mockResolvedValue(undefined);

      await expect(controller.getDefaultPaymentMethod()).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("validatePaymentMethodAfter3DS", () => {
    it("validates the payment method after confirming ownership", async () => {
      const { controller, stripe, user } = setup();
      stripe.retrievePaymentMethod.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: user.stripeCustomerId }));
      stripe.validatePaymentMethodAfter3DS.mockResolvedValue({ success: true });

      const result = await controller.validatePaymentMethodAfter3DS({ data: { paymentMethodId: "pm_1", paymentIntentId: "pi_1" } });

      expect(stripe.retrievePaymentMethod).toHaveBeenCalledWith("pm_1");
      expect(stripe.validatePaymentMethodAfter3DS).toHaveBeenCalledWith(user.stripeCustomerId, "pm_1", "pi_1");
      expect(result).toEqual({ success: true });
    });

    it("rejects when the payment method belongs to another customer", async () => {
      const { controller, stripe } = setup();
      stripe.retrievePaymentMethod.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: "cus_someoneelse" }));

      await expect(controller.validatePaymentMethodAfter3DS({ data: { paymentMethodId: "pm_1", paymentIntentId: "pi_1" } })).rejects.toMatchObject({
        status: 403
      });
      expect(stripe.validatePaymentMethodAfter3DS).not.toHaveBeenCalled();
    });
  });

  describe("markAsDefault", () => {
    it("delegates to PaymentMethodService with the current paying user and ability", async () => {
      const { controller, paymentMethodService, authService } = setup();

      await controller.markAsDefault({ data: { id: "pm_1" } });

      expect(paymentMethodService.markPaymentMethodAsDefault).toHaveBeenCalledWith("pm_1", authService.getCurrentPayingUser(), authService.ability);
    });
  });

  describe("getPaymentMethods", () => {
    it("returns the current user's payment methods", async () => {
      const { controller, paymentMethodService } = setup();
      const methods = [mock<PaymentMethod>({ id: "pm_1", isDefault: true })];
      paymentMethodService.getPaymentMethods.mockResolvedValue(methods);

      const result = await controller.getPaymentMethods();

      expect(result).toEqual({ data: methods });
    });

    it("returns an empty list when there is no current paying user", async () => {
      const { controller, authService, paymentMethodService } = setup();
      authService.getCurrentPayingUser.mockReturnValue(undefined as unknown as PayingUser);

      const result = await controller.getPaymentMethods();

      expect(result).toEqual({ data: [] });
      expect(paymentMethodService.getPaymentMethods).not.toHaveBeenCalled();
    });
  });

  function setup() {
    const user = createUser();
    const payingUser: PayingUser = { ...user, stripeCustomerId: user.stripeCustomerId! };
    const stripe = mock<StripeService>();
    const paymentMethodService = mock<PaymentMethodService>();
    const stripeTransaction = mock<StripeTransactionService>();
    const authService = mock<AuthService>({
      currentUser: user
    });
    authService.getCurrentPayingUser.mockReturnValue(payingUser);
    const stripeErrorService = mock<StripeErrorService>();
    const userWalletRepository = mock<UserWalletRepository>();
    const trialValidationService = mock<TrialValidationService>();
    const transactionReporting = mock<TransactionReportingService>();
    const controller = new StripeController(
      stripe,
      stripeTransaction,
      authService,
      stripeErrorService,
      userWalletRepository,
      trialValidationService,
      transactionReporting,
      paymentMethodService
    );
    container.register(AuthService, { useValue: authService });

    return {
      controller,
      stripe,
      paymentMethodService,
      stripeTransaction,
      authService,
      stripeErrorService,
      userWalletRepository,
      trialValidationService,
      user
    };
  }
});
