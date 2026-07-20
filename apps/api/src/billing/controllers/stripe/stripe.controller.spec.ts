import { faker } from "@faker-js/faker";
import type Stripe from "stripe";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { PayingUser } from "@src/billing/services/paying-user/paying-user";
import type { PaymentMethod, StripeService } from "@src/billing/services/stripe/stripe.service";
import type { StripeErrorService } from "@src/billing/services/stripe-error/stripe-error.service";
import type { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import { StripeController } from "./stripe.controller";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(StripeController.name, () => {
  describe("confirmPayment", () => {
    it("returns transactionId and transactionStatus on successful payment", async () => {
      const { controller, stripe, user } = setup();
      const transactionId = faker.string.uuid();

      stripe.hasPaymentMethod.mockResolvedValue(true);
      stripe.createPaymentIntent.mockResolvedValue({
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
      const { controller, stripe, user } = setup();
      const transactionId = faker.string.uuid();
      const resolvedTransaction = generateDatabaseStripeTransaction({ id: transactionId, status: "succeeded" });

      stripe.hasPaymentMethod.mockResolvedValue(true);
      stripe.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId,
        transactionStatus: "pending"
      });
      stripe.resolveTransaction.mockResolvedValue(resolvedTransaction);

      const result = await controller.confirmPayment({
        userId: user.id,
        paymentMethodId: faker.string.uuid(),
        amount: 100,
        awaitResolved: true
      });

      expect(stripe.resolveTransaction).toHaveBeenCalledWith(transactionId);
      expect(result).toEqual({
        data: {
          success: true,
          transactionId,
          transactionStatus: "succeeded"
        }
      });
    });

    it("invokes trial-min validation before contacting Stripe", async () => {
      const { controller, stripe, userWalletRepository, trialValidationService, user } = setup();
      const wallet = mock<UserWalletOutput>({ isTrialing: true });
      userWalletRepository.findOneByUserId.mockResolvedValue(wallet);
      stripe.hasPaymentMethod.mockResolvedValue(true);
      stripe.createPaymentIntent.mockResolvedValue({
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
      const { controller, stripe, userWalletRepository, trialValidationService, user } = setup();
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
      expect(stripe.hasPaymentMethod).not.toHaveBeenCalled();
      expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
    });

    it("forwards an undefined wallet to trial-min validation when no wallet exists", async () => {
      const { controller, userWalletRepository, trialValidationService, stripe, user } = setup();
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);
      stripe.hasPaymentMethod.mockResolvedValue(true);
      stripe.createPaymentIntent.mockResolvedValue({
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
      const { controller, stripe, user } = setup();
      const transactionId = faker.string.uuid();
      const paymentIntentId = faker.string.uuid();
      const clientSecret = faker.string.alphanumeric(32);

      stripe.hasPaymentMethod.mockResolvedValue(true);
      stripe.createPaymentIntent.mockResolvedValue({
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
  });

  describe("createSetupIntent", () => {
    it("passes isFreeTrial true when user wallet is trialing", async () => {
      const { controller, stripe, userWalletRepository, user } = setup();
      const clientSecret = faker.string.alphanumeric(32);

      userWalletRepository.findOneByUserId.mockResolvedValue(mock<UserWalletOutput>({ isTrialing: true }));
      stripe.getStripeCustomerId.mockResolvedValue(user.stripeCustomerId!);
      stripe.createSetupIntent.mockResolvedValue(mock<Stripe.SetupIntent>({ client_secret: clientSecret }));

      const result = await controller.createSetupIntent();

      expect(stripe.createSetupIntent).toHaveBeenCalledWith(user.stripeCustomerId, { isFreeTrial: true });
      expect(result).toEqual({ data: { clientSecret } });
    });

    it("passes isFreeTrial false when user wallet is not trialing", async () => {
      const { controller, stripe, userWalletRepository, user } = setup();
      const clientSecret = faker.string.alphanumeric(32);

      userWalletRepository.findOneByUserId.mockResolvedValue(mock<UserWalletOutput>({ isTrialing: false }));
      stripe.getStripeCustomerId.mockResolvedValue(user.stripeCustomerId!);
      stripe.createSetupIntent.mockResolvedValue(mock<Stripe.SetupIntent>({ client_secret: clientSecret }));

      const result = await controller.createSetupIntent();

      expect(stripe.createSetupIntent).toHaveBeenCalledWith(user.stripeCustomerId, { isFreeTrial: false });
      expect(result).toEqual({ data: { clientSecret } });
    });

    it("defaults isFreeTrial to true when no wallet exists", async () => {
      const { controller, stripe, userWalletRepository, user } = setup();
      const clientSecret = faker.string.alphanumeric(32);

      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);
      stripe.getStripeCustomerId.mockResolvedValue(user.stripeCustomerId!);
      stripe.createSetupIntent.mockResolvedValue(mock<Stripe.SetupIntent>({ client_secret: clientSecret }));

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
      const { controller, stripe, user } = setup();
      const transactionId = faker.string.uuid();
      const mockCoupon = mock<Stripe.Coupon>({ id: faker.string.uuid() });
      const resolvedTransaction = generateDatabaseStripeTransaction({ id: transactionId, status: "succeeded" });

      stripe.applyCoupon.mockResolvedValue({
        coupon: mockCoupon,
        amountAdded: 10,
        transactionId,
        transactionStatus: "pending"
      });
      stripe.resolveTransaction.mockResolvedValue(resolvedTransaction);

      const result = await controller.applyCoupon({
        couponId: faker.string.alphanumeric(10),
        userId: user.id,
        awaitResolved: true
      });

      expect(stripe.resolveTransaction).toHaveBeenCalledWith(transactionId);
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
      stripe.paymentMethods.retrieve.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: user.stripeCustomerId }));

      await controller.removePaymentMethod(paymentMethodId);

      expect(stripe.paymentMethods.detach).toHaveBeenCalledWith(paymentMethodId);
      expect(userWalletRepository.findOneByUserId).not.toHaveBeenCalled();
    });

    it("rejects when the payment method does not belong to the user", async () => {
      const { controller, stripe } = setup();
      const paymentMethodId = faker.string.uuid();
      stripe.paymentMethods.retrieve.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: "cus_someoneelse" }));

      await expect(controller.removePaymentMethod(paymentMethodId)).rejects.toMatchObject({ status: 403 });
      expect(stripe.paymentMethods.detach).not.toHaveBeenCalled();
    });
  });

  describe("getDefaultPaymentMethod", () => {
    it("returns the default payment method for the current paying user", async () => {
      const { controller, stripe } = setup();
      const paymentMethod = mock<PaymentMethod>({ id: faker.string.uuid(), isDefault: true });
      stripe.getDefaultPaymentMethod.mockResolvedValue(paymentMethod);

      const result = await controller.getDefaultPaymentMethod();

      expect(result).toEqual({ data: paymentMethod });
    });

    it("throws 404 when the current user has no Stripe customer", async () => {
      const { controller, authService, stripe } = setup();
      authService.getCurrentPayingUser.mockReturnValue(undefined as unknown as PayingUser);

      await expect(controller.getDefaultPaymentMethod()).rejects.toMatchObject({ status: 404 });
      expect(stripe.getDefaultPaymentMethod).not.toHaveBeenCalled();
    });

    it("throws 404 when no default payment method exists", async () => {
      const { controller, stripe } = setup();
      stripe.getDefaultPaymentMethod.mockResolvedValue(undefined);

      await expect(controller.getDefaultPaymentMethod()).rejects.toMatchObject({ status: 404 });
    });
  });

  function setup() {
    const user = createUser();
    const payingUser: PayingUser = { ...user, stripeCustomerId: user.stripeCustomerId! };
    const stripe = mock<StripeService>();
    stripe.paymentMethods = mock<Stripe.PaymentMethodsResource>();
    const authService = mock<AuthService>({
      currentUser: user
    });
    authService.getCurrentPayingUser.mockReturnValue(payingUser);
    const stripeErrorService = mock<StripeErrorService>();
    const userWalletRepository = mock<UserWalletRepository>();
    const trialValidationService = mock<TrialValidationService>();
    const controller = new StripeController(stripe, authService, stripeErrorService, userWalletRepository, trialValidationService);
    container.register(AuthService, { useValue: authService });

    return {
      controller,
      stripe,
      authService,
      stripeErrorService,
      userWalletRepository,
      trialValidationService,
      user
    };
  }
});
