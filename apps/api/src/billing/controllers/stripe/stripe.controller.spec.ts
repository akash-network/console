import { faker } from "@faker-js/faker";
import type Stripe from "stripe";
import { container } from "tsyringe";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { PayingUser } from "@src/billing/services/paying-user/paying-user";
import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import type { StripeErrorService } from "@src/billing/services/stripe-error/stripe-error.service";
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
        amount: 100,
        currency: "usd"
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
        currency: "usd",
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
        amount: 100,
        currency: "usd"
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

      userWalletRepository.findOneByUserId.mockResolvedValue({ isTrialing: true } as any);
      stripe.getStripeCustomerId.mockResolvedValue(user.stripeCustomerId!);
      stripe.createSetupIntent.mockResolvedValue({ client_secret: clientSecret } as any);

      const result = await controller.createSetupIntent();

      expect(stripe.createSetupIntent).toHaveBeenCalledWith(user.stripeCustomerId, { isFreeTrial: true });
      expect(result).toEqual({ data: { clientSecret } });
    });

    it("passes isFreeTrial false when user wallet is not trialing", async () => {
      const { controller, stripe, userWalletRepository, user } = setup();
      const clientSecret = faker.string.alphanumeric(32);

      userWalletRepository.findOneByUserId.mockResolvedValue({ isTrialing: false } as any);
      stripe.getStripeCustomerId.mockResolvedValue(user.stripeCustomerId!);
      stripe.createSetupIntent.mockResolvedValue({ client_secret: clientSecret } as any);

      const result = await controller.createSetupIntent();

      expect(stripe.createSetupIntent).toHaveBeenCalledWith(user.stripeCustomerId, { isFreeTrial: false });
      expect(result).toEqual({ data: { clientSecret } });
    });

    it("defaults isFreeTrial to true when no wallet exists", async () => {
      const { controller, stripe, userWalletRepository, user } = setup();
      const clientSecret = faker.string.alphanumeric(32);

      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);
      stripe.getStripeCustomerId.mockResolvedValue(user.stripeCustomerId!);
      stripe.createSetupIntent.mockResolvedValue({ client_secret: clientSecret } as any);

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

  function setup() {
    const user = createUser();
    const payingUser: PayingUser = { ...user, stripeCustomerId: user.stripeCustomerId! };
    const stripe = mock<StripeService>();
    const authService = mock<AuthService>({
      currentUser: user
    });
    authService.getCurrentPayingUser.mockReturnValue(payingUser);
    const stripeErrorService = mock<StripeErrorService>();
    const userWalletRepository = mock<UserWalletRepository>();
    const controller = new StripeController(stripe, authService, stripeErrorService, userWalletRepository);
    container.register(AuthService, { useValue: authService });

    return {
      controller,
      stripe,
      authService,
      stripeErrorService,
      userWalletRepository,
      user
    };
  }
});
