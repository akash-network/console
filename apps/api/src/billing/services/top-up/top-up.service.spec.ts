import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { PayingUser } from "@src/billing/services/paying-user/paying-user";
import type { PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import type { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import type { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import type { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import { TopUpService } from "./top-up.service";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(TopUpService.name, () => {
  describe("topUp", () => {
    it("throws a retriable 409 without charging when the wallet is still provisioning", async () => {
      const { service, stripeTransactionService, trialActivationJobService, userWalletRepository, payingUser } = setup();
      userWalletRepository.findOneByUserId.mockResolvedValue(mock<UserWalletOutput>({ activatedAt: null }));
      trialActivationJobService.assertActivated.mockRejectedValue(createError(409, "provisioning", { errorCode: "wallet_provisioning" }));

      await expect(service.topUp(payingUser, { paymentMethodId: faker.string.uuid(), amount: 100 })).rejects.toMatchObject({
        status: 409,
        errorCode: "wallet_provisioning"
      });
      expect(stripeTransactionService.createPaymentIntent).not.toHaveBeenCalled();
    });

    it("returns transactionId and transactionStatus on successful payment", async () => {
      const { service, stripeTransactionService, paymentMethodService, payingUser } = setup();
      const transactionId = faker.string.uuid();

      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransactionService.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId,
        transactionStatus: "pending"
      });

      const result = await service.topUp(payingUser, { paymentMethodId: faker.string.uuid(), amount: 100 });

      expect(result).toEqual({ success: true, transactionId, transactionStatus: "pending" });
    });

    it("resolves the transaction when awaitResolved is true", async () => {
      const { service, stripeTransactionService, paymentMethodService, payingUser } = setup();
      const transactionId = faker.string.uuid();
      const resolvedTransaction = generateDatabaseStripeTransaction({ id: transactionId, status: "succeeded" });

      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransactionService.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId,
        transactionStatus: "pending"
      });
      stripeTransactionService.resolveTransaction.mockResolvedValue(resolvedTransaction);

      const result = await service.topUp(payingUser, { paymentMethodId: faker.string.uuid(), amount: 100, awaitResolved: true });

      expect(stripeTransactionService.resolveTransaction).toHaveBeenCalledWith(transactionId);
      expect(result).toEqual({ success: true, transactionId, transactionStatus: "succeeded" });
    });

    it("validates the top-up amount against the wallet before contacting Stripe", async () => {
      const { service, stripeTransactionService, userWalletRepository, trialValidationService, paymentMethodService, payingUser } = setup();
      const wallet = mock<UserWalletOutput>({ isTrialing: true });
      userWalletRepository.findOneByUserId.mockResolvedValue(wallet);
      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransactionService.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId: faker.string.uuid(),
        transactionStatus: "pending"
      });

      await service.topUp(payingUser, { paymentMethodId: faker.string.uuid(), amount: 100 });

      expect(trialValidationService.validateTopUpAmount).toHaveBeenCalledWith(wallet, 100);
    });

    it("propagates the amount-validation rejection without ever calling Stripe", async () => {
      const { service, stripeTransactionService, userWalletRepository, trialValidationService, paymentMethodService, payingUser } = setup();
      userWalletRepository.findOneByUserId.mockResolvedValue(mock<UserWalletOutput>({ isTrialing: true }));
      const trialError = Object.assign(new Error("First top-up must be at least $100 while on the free trial."), { status: 402 });
      trialValidationService.validateTopUpAmount.mockImplementation(() => {
        throw trialError;
      });

      await expect(service.topUp(payingUser, { paymentMethodId: faker.string.uuid(), amount: 50 })).rejects.toBe(trialError);
      expect(paymentMethodService.hasPaymentMethod).not.toHaveBeenCalled();
      expect(stripeTransactionService.createPaymentIntent).not.toHaveBeenCalled();
    });

    it("forwards an undefined wallet to amount validation when no wallet exists", async () => {
      const { service, stripeTransactionService, userWalletRepository, trialValidationService, paymentMethodService, payingUser } = setup();
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);
      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransactionService.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId: faker.string.uuid(),
        transactionStatus: "pending"
      });

      await service.topUp(payingUser, { paymentMethodId: faker.string.uuid(), amount: 50 });

      expect(trialValidationService.validateTopUpAmount).toHaveBeenCalledWith(undefined, 50);
    });

    it("rejects when the payment method does not belong to the user", async () => {
      const { service, stripeTransactionService, paymentMethodService, payingUser } = setup();
      paymentMethodService.hasPaymentMethod.mockResolvedValue(false);

      await expect(service.topUp(payingUser, { paymentMethodId: faker.string.uuid(), amount: 100 })).rejects.toMatchObject({ status: 403 });
      expect(stripeTransactionService.createPaymentIntent).not.toHaveBeenCalled();
    });

    it("charges with the reject amount-mismatch policy", async () => {
      const { service, stripeTransactionService, paymentMethodService, payingUser } = setup();

      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransactionService.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId: faker.string.uuid(),
        transactionStatus: "pending"
      });

      await service.topUp(payingUser, { paymentMethodId: faker.string.uuid(), amount: 100 });

      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ onAmountMismatch: "reject" }));
    });

    it("returns 3DS data when the charge requires action", async () => {
      const { service, stripeTransactionService, paymentMethodService, payingUser } = setup();
      const transactionId = faker.string.uuid();
      const paymentIntentId = faker.string.uuid();
      const clientSecret = faker.string.alphanumeric(32);

      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransactionService.createPaymentIntent.mockResolvedValue({
        success: false,
        requiresAction: true,
        clientSecret,
        paymentIntentId,
        transactionId,
        transactionStatus: "requires_action"
      });

      const result = await service.topUp(payingUser, { paymentMethodId: faker.string.uuid(), amount: 100 });

      expect(result).toEqual({
        success: false,
        requiresAction: true,
        clientSecret,
        paymentIntentId,
        transactionId,
        transactionStatus: "requires_action"
      });
    });

    it("throws when the charge is neither successful nor a 3DS challenge", async () => {
      const { service, stripeTransactionService, paymentMethodService, payingUser } = setup();

      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransactionService.createPaymentIntent.mockResolvedValue({
        success: false,
        transactionId: faker.string.uuid()
      });

      await expect(service.topUp(payingUser, { paymentMethodId: faker.string.uuid(), amount: 100 })).rejects.toThrow("Payment not successful");
    });

    it("namespaces the client attempt key with the user id before calling Stripe", async () => {
      const { service, stripeTransactionService, paymentMethodService, payingUser } = setup();
      const clientKey = faker.string.uuid();

      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransactionService.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId: faker.string.uuid(),
        transactionStatus: "pending"
      });

      await service.topUp(payingUser, { paymentMethodId: faker.string.uuid(), amount: 100, idempotencyKey: clientKey });

      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: `topup_${payingUser.id}_${clientKey}` })
      );
    });

    it("passes no idempotency key to Stripe when the client sends none", async () => {
      const { service, stripeTransactionService, paymentMethodService, payingUser } = setup();

      paymentMethodService.hasPaymentMethod.mockResolvedValue(true);
      stripeTransactionService.createPaymentIntent.mockResolvedValue({
        success: true,
        paymentIntentId: faker.string.uuid(),
        transactionId: faker.string.uuid(),
        transactionStatus: "pending"
      });

      await service.topUp(payingUser, { paymentMethodId: faker.string.uuid(), amount: 100 });

      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: undefined }));
    });
  });

  function setup() {
    const user = createUser();
    const payingUser: PayingUser = { ...user, stripeCustomerId: user.stripeCustomerId! };
    const userWalletRepository = mock<UserWalletRepository>();
    const trialActivationJobService = mock<TrialActivationJobService>();
    const trialValidationService = mock<TrialValidationService>();
    const paymentMethodService = mock<PaymentMethodService>();
    const stripeTransactionService = mock<StripeTransactionService>();
    const service = new TopUpService(userWalletRepository, trialActivationJobService, trialValidationService, paymentMethodService, stripeTransactionService);

    return { service, userWalletRepository, trialActivationJobService, trialValidationService, paymentMethodService, stripeTransactionService, payingUser };
  }
});
