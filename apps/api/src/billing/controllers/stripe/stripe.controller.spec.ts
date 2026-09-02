import { faker } from "@faker-js/faker";
import createError from "http-errors";
import type Stripe from "stripe";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { AutoReloadPauseService } from "@src/billing/services/auto-reload-pause/auto-reload-pause.service";
import type { CouponRedemptionService } from "@src/billing/services/coupon-redemption/coupon-redemption.service";
import type { CustomerService } from "@src/billing/services/customer/customer.service";
import type { PayingUser } from "@src/billing/services/paying-user/paying-user";
import type { PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import { type PaymentMethod } from "@src/billing/services/payment-method/payment-method.service";
import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import type { StripeErrorService } from "@src/billing/services/stripe-error/stripe-error.service";
import type { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import type { TopUpService } from "@src/billing/services/top-up/top-up.service";
import type { TransactionReportingService } from "@src/billing/services/transaction-reporting/transaction-reporting.service";
import type { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import type { WalletSettingService } from "@src/billing/services/wallet-settings/wallet-settings.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { StripeController } from "./stripe.controller";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(StripeController.name, () => {
  describe("confirmPayment", () => {
    it("delegates to TopUpService and wraps the result in a data envelope", async () => {
      const { controller, topUpService, authService, user } = setup();
      const data = { success: true as const, transactionId: faker.string.uuid(), transactionStatus: "pending" as const };
      topUpService.topUp.mockResolvedValue(data);

      const result = await controller.confirmPayment({
        userId: user.id,
        paymentMethodId: "pm_1",
        amount: 100,
        idempotencyKey: "key_1",
        awaitResolved: true
      });

      expect(topUpService.topUp).toHaveBeenCalledWith(authService.getCurrentPayingUser(), {
        amount: 100,
        paymentMethodId: "pm_1",
        idempotencyKey: "key_1",
        awaitResolved: true
      });
      expect(result).toEqual({ data });
    });

    it("throws a 500 without charging when there is no current paying user", async () => {
      const { controller, topUpService, authService } = setup();
      authService.getCurrentPayingUser.mockReturnValue(undefined as unknown as PayingUser);

      await expect(controller.confirmPayment({ userId: faker.string.uuid(), paymentMethodId: "pm_1", amount: 100 })).rejects.toMatchObject({
        status: 500
      });
      expect(topUpService.topUp).not.toHaveBeenCalled();
    });

    it("maps a known payment error through StripeErrorService", async () => {
      const { controller, topUpService, stripeErrorService, user } = setup();
      const rawError = new Error("Payment not successful");
      const mappedError = createError(402, "Payment not successful");
      topUpService.topUp.mockRejectedValue(rawError);
      stripeErrorService.isKnownError.mockReturnValue(true);
      stripeErrorService.toAppError.mockReturnValue(mappedError);

      await expect(controller.confirmPayment({ userId: user.id, paymentMethodId: "pm_1", amount: 100 })).rejects.toBe(mappedError);
      expect(stripeErrorService.toAppError).toHaveBeenCalledWith(rawError, "payment");
    });

    it("rethrows an unknown error unchanged", async () => {
      const { controller, topUpService, stripeErrorService, user } = setup();
      const rawError = new Error("boom");
      topUpService.topUp.mockRejectedValue(rawError);
      stripeErrorService.isKnownError.mockReturnValue(false);

      await expect(controller.confirmPayment({ userId: user.id, paymentMethodId: "pm_1", amount: 100 })).rejects.toBe(rawError);
      expect(stripeErrorService.toAppError).not.toHaveBeenCalled();
    });
  });

  describe("createSetupIntent", () => {
    it("passes isFreeTrial true when user wallet is trialing", async () => {
      const { controller, stripe, customerService, userWalletRepository, user } = setup();
      const clientSecret = faker.string.alphanumeric(32);

      userWalletRepository.findOneByUserId.mockResolvedValue(mock<UserWalletOutput>({ isTrialing: true }));
      customerService.getStripeCustomerId.mockResolvedValue(user.stripeCustomerId!);
      stripe.createSetupIntent.mockResolvedValue(mock<Stripe.Response<Stripe.SetupIntent>>({ client_secret: clientSecret }));

      const result = await controller.createSetupIntent();

      expect(stripe.createSetupIntent).toHaveBeenCalledWith(user.stripeCustomerId, { isFreeTrial: true });
      expect(result).toEqual({ data: { clientSecret } });
    });

    it("passes isFreeTrial false when user wallet is not trialing", async () => {
      const { controller, stripe, customerService, userWalletRepository, user } = setup();
      const clientSecret = faker.string.alphanumeric(32);

      userWalletRepository.findOneByUserId.mockResolvedValue(mock<UserWalletOutput>({ isTrialing: false }));
      customerService.getStripeCustomerId.mockResolvedValue(user.stripeCustomerId!);
      stripe.createSetupIntent.mockResolvedValue(mock<Stripe.Response<Stripe.SetupIntent>>({ client_secret: clientSecret }));

      const result = await controller.createSetupIntent();

      expect(stripe.createSetupIntent).toHaveBeenCalledWith(user.stripeCustomerId, { isFreeTrial: false });
      expect(result).toEqual({ data: { clientSecret } });
    });

    it("defaults isFreeTrial to true when no wallet exists", async () => {
      const { controller, stripe, customerService, userWalletRepository, user } = setup();
      const clientSecret = faker.string.alphanumeric(32);

      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);
      customerService.getStripeCustomerId.mockResolvedValue(user.stripeCustomerId!);
      stripe.createSetupIntent.mockResolvedValue(mock<Stripe.Response<Stripe.SetupIntent>>({ client_secret: clientSecret }));

      const result = await controller.createSetupIntent();

      expect(stripe.createSetupIntent).toHaveBeenCalledWith(user.stripeCustomerId, { isFreeTrial: true });
      expect(result).toEqual({ data: { clientSecret } });
    });
  });

  describe("applyCoupon", () => {
    it("throws a retriable 409 without redeeming when the wallet is still provisioning", async () => {
      const { controller, couponRedemptionService, trialActivationJobService, userWalletRepository, user } = setup();
      userWalletRepository.findOneByUserId.mockResolvedValue(mock<UserWalletOutput>({ activatedAt: null }));
      trialActivationJobService.assertActivated.mockRejectedValue(createError(409, "provisioning", { errorCode: "wallet_provisioning" }));

      await expect(controller.applyCoupon({ couponId: faker.string.alphanumeric(10), userId: user.id })).rejects.toMatchObject({
        status: 409,
        errorCode: "wallet_provisioning"
      });
      expect(couponRedemptionService.redeemCoupon).not.toHaveBeenCalled();
    });

    it("returns transactionId and transactionStatus on successful coupon", async () => {
      const { controller, couponRedemptionService, user } = setup();
      const transactionId = faker.string.uuid();
      const mockCoupon = mock<Stripe.Coupon>({ id: faker.string.uuid() });

      couponRedemptionService.redeemCoupon.mockResolvedValue({
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
      const { controller, couponRedemptionService, stripeTransaction, user } = setup();
      const transactionId = faker.string.uuid();
      const mockCoupon = mock<Stripe.Coupon>({ id: faker.string.uuid() });
      const resolvedTransaction = generateDatabaseStripeTransaction({ id: transactionId, status: "succeeded" });

      couponRedemptionService.redeemCoupon.mockResolvedValue({
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
    it("disables auto reload after detaching when the removed method is the default", async () => {
      const { controller, stripe, paymentMethodService, walletSettingService, user } = setup();
      const paymentMethodId = faker.string.uuid();
      stripe.retrievePaymentMethod.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: user.stripeCustomerId }));
      paymentMethodService.isDefaultPaymentMethod.mockResolvedValue(true);

      await controller.removePaymentMethod(paymentMethodId);

      expect(paymentMethodService.isDefaultPaymentMethod).toHaveBeenCalledWith(paymentMethodId, user.id);
      expect(stripe.detachPaymentMethod).toHaveBeenCalledWith(paymentMethodId);
      expect(walletSettingService.disableAutoReload).toHaveBeenCalledWith(user.id);
      expect(stripe.detachPaymentMethod.mock.invocationCallOrder[0]).toBeLessThan(walletSettingService.disableAutoReload.mock.invocationCallOrder[0]);
    });

    it("does not disable auto reload when the removed method is not the default", async () => {
      const { controller, stripe, paymentMethodService, walletSettingService, user } = setup();
      const paymentMethodId = faker.string.uuid();
      stripe.retrievePaymentMethod.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: user.stripeCustomerId }));
      paymentMethodService.isDefaultPaymentMethod.mockResolvedValue(false);

      await controller.removePaymentMethod(paymentMethodId);

      expect(stripe.detachPaymentMethod).toHaveBeenCalledWith(paymentMethodId);
      expect(walletSettingService.disableAutoReload).not.toHaveBeenCalled();
    });

    it("rejects when the payment method does not belong to the user", async () => {
      const { controller, stripe, walletSettingService } = setup();
      const paymentMethodId = faker.string.uuid();
      stripe.retrievePaymentMethod.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: "cus_someoneelse" }));

      await expect(controller.removePaymentMethod(paymentMethodId)).rejects.toMatchObject({ status: 403 });
      expect(stripe.detachPaymentMethod).not.toHaveBeenCalled();
      expect(walletSettingService.disableAutoReload).not.toHaveBeenCalled();
    });

    it("does not disable auto reload when the detach fails", async () => {
      const { controller, stripe, paymentMethodService, walletSettingService, user } = setup();
      const paymentMethodId = faker.string.uuid();
      stripe.retrievePaymentMethod.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: user.stripeCustomerId }));
      paymentMethodService.isDefaultPaymentMethod.mockResolvedValue(true);
      stripe.detachPaymentMethod.mockRejectedValue(new Error("detach failed"));

      await expect(controller.removePaymentMethod(paymentMethodId)).rejects.toThrow("detach failed");
      expect(walletSettingService.disableAutoReload).not.toHaveBeenCalled();
    });

    it("does not fail the request when disabling auto reload throws after detaching the default method", async () => {
      const { controller, stripe, paymentMethodService, walletSettingService, logger, user } = setup();
      const paymentMethodId = faker.string.uuid();
      stripe.retrievePaymentMethod.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: user.stripeCustomerId }));
      paymentMethodService.isDefaultPaymentMethod.mockResolvedValue(true);
      walletSettingService.disableAutoReload.mockRejectedValue(new Error("db down"));

      await expect(controller.removePaymentMethod(paymentMethodId)).resolves.toBeUndefined();

      expect(stripe.detachPaymentMethod).toHaveBeenCalledWith(paymentMethodId);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "AUTO_RELOAD_DISABLE_AFTER_REMOVAL_FAILED", userId: user.id }));
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
      const { controller, stripe, paymentMethodService, user } = setup();
      stripe.retrievePaymentMethod.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: user.stripeCustomerId }));
      paymentMethodService.validatePaymentMethodAfter3DS.mockResolvedValue({ success: true });

      const result = await controller.validatePaymentMethodAfter3DS({ data: { paymentMethodId: "pm_1", paymentIntentId: "pi_1" } });

      expect(stripe.retrievePaymentMethod).toHaveBeenCalledWith("pm_1");
      expect(paymentMethodService.validatePaymentMethodAfter3DS).toHaveBeenCalledWith(user.stripeCustomerId, "pm_1", "pi_1");
      expect(result).toEqual({ success: true });
    });

    it("rejects when the payment method belongs to another customer", async () => {
      const { controller, stripe, paymentMethodService } = setup();
      stripe.retrievePaymentMethod.mockResolvedValue(mock<Stripe.Response<Stripe.PaymentMethod>>({ customer: "cus_someoneelse" }));

      await expect(controller.validatePaymentMethodAfter3DS({ data: { paymentMethodId: "pm_1", paymentIntentId: "pi_1" } })).rejects.toMatchObject({
        status: 403
      });
      expect(paymentMethodService.validatePaymentMethodAfter3DS).not.toHaveBeenCalled();
    });
  });

  describe("markAsDefault", () => {
    it("delegates to PaymentMethodService with the current paying user and ability", async () => {
      const { controller, paymentMethodService, authService } = setup();

      await controller.markAsDefault({ data: { id: "pm_1" } });

      expect(paymentMethodService.markPaymentMethodAsDefault).toHaveBeenCalledWith("pm_1", authService.getCurrentPayingUser(), authService.ability);
    });

    it("resumes auto top-up so a wallet paused by declines starts charging the new card", async () => {
      const { controller, autoReloadPauseService, user } = setup();

      await controller.markAsDefault({ data: { id: "pm_1" } });

      expect(autoReloadPauseService.resume).toHaveBeenCalledWith(user.id);
    });

    it("keeps the new default card when resuming auto top-up fails", async () => {
      const { controller, autoReloadPauseService, logger, user } = setup();
      const error = new Error("connection terminated");
      autoReloadPauseService.resume.mockRejectedValue(error);

      await expect(controller.markAsDefault({ data: { id: "pm_1" } })).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ event: "AUTO_RELOAD_RESUME_AFTER_DEFAULT_CHANGE_FAILED", userId: user.id, error });
    });
  });

  describe("getPaymentMethods", () => {
    it("returns the current user's payment methods", async () => {
      const { controller, authService, paymentMethodService } = setup();
      const methods = [mock<PaymentMethod>({ id: "pm_1", isDefault: true })];
      paymentMethodService.getPaymentMethods.mockResolvedValue(methods);

      const result = await controller.getPaymentMethods();

      expect(paymentMethodService.getPaymentMethods).toHaveBeenCalledWith(authService.getCurrentPayingUser(), authService.ability);
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

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: StripeController.name });
  });

  function setup() {
    const user = createUser();
    const payingUser: PayingUser = { ...user, stripeCustomerId: user.stripeCustomerId! };
    const stripe = mock<StripeService>();
    const paymentMethodService = mock<PaymentMethodService>();
    const couponRedemptionService = mock<CouponRedemptionService>();
    const customerService = mock<CustomerService>();
    const stripeTransaction = mock<StripeTransactionService>();
    const topUpService = mock<TopUpService>();
    const authService = mock<AuthService>({
      currentUser: user
    });
    authService.getCurrentPayingUser.mockReturnValue(payingUser);
    const stripeErrorService = mock<StripeErrorService>();
    const userWalletRepository = mock<UserWalletRepository>();
    const trialActivationJobService = mock<TrialActivationJobService>();
    const transactionReporting = mock<TransactionReportingService>();
    const walletSettingService = mock<WalletSettingService>();
    const autoReloadPauseService = mock<AutoReloadPauseService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const controller = new StripeController(
      stripe,
      stripeTransaction,
      topUpService,
      authService,
      stripeErrorService,
      userWalletRepository,
      trialActivationJobService,
      transactionReporting,
      paymentMethodService,
      couponRedemptionService,
      customerService,
      walletSettingService,
      autoReloadPauseService,
      createLogger
    );
    container.register(AuthService, { useValue: authService });

    return {
      controller,
      stripe,
      paymentMethodService,
      couponRedemptionService,
      customerService,
      stripeTransaction,
      topUpService,
      authService,
      stripeErrorService,
      userWalletRepository,
      trialActivationJobService,
      walletSettingService,
      autoReloadPauseService,
      logger,
      createLogger,
      user
    };
  }
});
