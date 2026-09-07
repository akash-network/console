import type { LoggerService } from "@akashnetwork/logging";
import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PaymentMethodRepository } from "@src/billing/repositories";
import type { AutoReloadPauseService } from "@src/billing/services/auto-reload-pause/auto-reload-pause.service";
import type { PayingUser } from "@src/billing/services/paying-user/paying-user";
import type { UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import { PaymentMethodService } from "./payment-method.service";

import { generateDatabasePaymentMethod } from "@test/seeders/database-payment-method.seeder";
import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { TEST_CONSTANTS } from "@test/seeders/stripe-test-data.seeder";

const ability = createMongoAbility([{ action: "manage", subject: "all" }]);
const asResponse = <T>(value: T) => value as unknown as Stripe.Response<T>;
const resourceMissingError = () =>
  new Stripe.errors.StripeInvalidRequestError({
    type: "invalid_request_error",
    code: "resource_missing",
    message: "No such PaymentMethod"
  } as Stripe.StripeRawError);

describe(PaymentMethodService.name, () => {
  describe("getPaymentMethods", () => {
    const payingUser = () => mock<PayingUser>({ id: TEST_CONSTANTS.USER_ID, stripeCustomerId: TEST_CONSTANTS.CUSTOMER_ID });

    it("returns remote methods merged with local validated/default flags, newest first", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const newer = generatePaymentMethod({ id: TEST_CONSTANTS.PAYMENT_METHOD_ID, created: 1757992768, card: { fingerprint: "fp_a" } });
      const older = generatePaymentMethod({ id: "pm_456", created: 1757991776, card: { fingerprint: "fp_b" } });
      vi.spyOn(stripe.paymentMethods, "list").mockResolvedValue({
        data: [older, newer],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>);
      paymentMethodRepository.findByUserId.mockResolvedValue([
        generateDatabasePaymentMethod({ paymentMethodId: newer.id, fingerprint: "fp_a", isDefault: true, isValidated: true }),
        generateDatabasePaymentMethod({ paymentMethodId: older.id, fingerprint: "fp_b" })
      ]);

      const result = await service.getPaymentMethods(payingUser(), ability);

      expect(stripe.paymentMethods.list).toHaveBeenCalledWith({ customer: TEST_CONSTANTS.CUSTOMER_ID });
      expect(paymentMethodRepository.deleteByFingerprint).not.toHaveBeenCalled();
      expect(result).toEqual([
        { ...newer, validated: true, isDefault: true },
        { ...older, validated: false, isDefault: false }
      ]);
    });

    it("warns without repairing when an unsynced remote method has no fingerprint", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const unfingerprintable = generatePaymentMethod({ type: "us_bank_account", card: null } as unknown as Parameters<typeof generatePaymentMethod>[0]);
      vi.spyOn(stripe.paymentMethods, "list").mockResolvedValue({
        data: [unfingerprintable],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>);
      paymentMethodRepository.findByUserId.mockResolvedValue([]);

      const result = await service.getPaymentMethods(payingUser(), ability);

      expect(paymentMethodRepository.deleteByFingerprint).not.toHaveBeenCalled();
      expect(result).toEqual([{ ...unfingerprintable, validated: false, isDefault: false }]);
    });

    it("removes stale local rows absent from Stripe when the list is complete", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const stale = generateDatabasePaymentMethod({ paymentMethodId: "pm_stale", fingerprint: "fp_stale" });
      vi.spyOn(stripe.paymentMethods, "list").mockResolvedValue({
        data: [],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>);
      paymentMethodRepository.findByUserId.mockResolvedValueOnce([stale]).mockResolvedValueOnce([]);

      const result = await service.getPaymentMethods(payingUser(), ability);

      expect(paymentMethodRepository.deleteByFingerprint).toHaveBeenCalledWith("fp_stale", "pm_stale", TEST_CONSTANTS.USER_ID);
      expect(result).toEqual([]);
    });

    it("keeps local rows absent from a truncated Stripe list", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const onPage = generatePaymentMethod({ id: "pm_on_page", card: { fingerprint: "fp_on_page" } });
      const local = generateDatabasePaymentMethod({ paymentMethodId: onPage.id, fingerprint: "fp_on_page" });
      const offPage = generateDatabasePaymentMethod({ paymentMethodId: "pm_off_page", fingerprint: "fp_off_page" });
      vi.spyOn(stripe.paymentMethods, "list").mockResolvedValue({
        data: [onPage],
        has_more: true
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>);
      paymentMethodRepository.findByUserId.mockResolvedValue([local, offPage]);

      const result = await service.getPaymentMethods(payingUser(), ability);

      expect(paymentMethodRepository.deleteByFingerprint).not.toHaveBeenCalled();
      expect(result).toEqual([{ ...onPage, validated: false, isDefault: false }]);
    });

    it("reports only the successfully repaired ids when one repair throws", async () => {
      const { service, stripe, paymentMethodRepository, logger } = setup();
      const older = generatePaymentMethod({ id: "pm_older", created: 1, card: { fingerprint: "fp_older" } });
      const newer = generatePaymentMethod({ id: "pm_newer", created: 2, card: { fingerprint: "fp_newer" } });
      vi.spyOn(stripe.paymentMethods, "list").mockResolvedValue({
        data: [older, newer],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>);
      paymentMethodRepository.findByUserId.mockResolvedValue([]);
      vi.spyOn(service, "syncAttached").mockResolvedValueOnce({ isNew: true, isDefault: true }).mockRejectedValueOnce(new Error("db unavailable"));

      await service.getPaymentMethods(payingUser(), ability);

      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "PAYMENT_METHOD_READ_REPAIRED", paymentMethodIds: ["pm_older"] }));
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "PAYMENT_METHOD_READ_REPAIR_FAILED", paymentMethodId: "pm_newer" }));
    });

    it("does not fail the read when removing a stale local row throws", async () => {
      const { service, stripe, paymentMethodRepository, logger } = setup();
      const stale = generateDatabasePaymentMethod({ paymentMethodId: "pm_stale", fingerprint: "fp_stale" });
      vi.spyOn(stripe.paymentMethods, "list").mockResolvedValue({
        data: [],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>);
      paymentMethodRepository.findByUserId.mockResolvedValue([stale]);
      paymentMethodRepository.deleteByFingerprint.mockRejectedValue(new Error("db unavailable"));

      const result = await service.getPaymentMethods(payingUser(), ability);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "PAYMENT_METHOD_STALE_REMOVE_FAILED", paymentMethodId: "pm_stale" }));
    });
  });

  describe("getDefaultPaymentMethod", () => {
    const user = () => mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" });

    it("returns undefined without calling Stripe when there is no local default", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(undefined);
      const retrieve = vi.spyOn(stripe.paymentMethods, "retrieve");

      const result = await service.getDefaultPaymentMethod(user(), ability);

      expect(result).toBeUndefined();
      expect(retrieve).not.toHaveBeenCalled();
    });

    it("merges the Stripe method with the local default when it is attached to the user's customer", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const local = generateDatabasePaymentMethod({ paymentMethodId: "pm_1", isDefault: true, isValidated: true });
      const remote = generatePaymentMethod({ id: "pm_1", customer: "cus_1" });
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(local);
      const retrieve = vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(asResponse(remote));

      const result = await service.getDefaultPaymentMethod(user(), ability);

      expect(retrieve).toHaveBeenCalledWith("pm_1", undefined, { timeout: 3_000 });
      expect(result).toEqual({ ...remote, validated: true, isDefault: true });
    });

    it("returns undefined and warns when the method belongs to a different customer", async () => {
      const { service, stripe, paymentMethodRepository, logger } = setup();
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(generateDatabasePaymentMethod({ paymentMethodId: "pm_1", isDefault: true }));
      vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(asResponse(generatePaymentMethod({ id: "pm_1", customer: "cus_other" })));

      const result = await service.getDefaultPaymentMethod(user(), ability);

      expect(result).toBeUndefined();
      expect(paymentMethodRepository.deleteByFingerprint).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "DEFAULT_PAYMENT_METHOD_NOT_ATTACHED", userId: "user_1", paymentMethodId: "pm_1" });
    });

    it("returns undefined and warns when the method is detached", async () => {
      const { service, stripe, paymentMethodRepository, logger } = setup();
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(generateDatabasePaymentMethod({ paymentMethodId: "pm_1", isDefault: true }));
      vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(asResponse(generatePaymentMethod({ id: "pm_1", customer: null })));

      const result = await service.getDefaultPaymentMethod(user(), ability);

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "DEFAULT_PAYMENT_METHOD_NOT_ATTACHED", paymentMethodId: "pm_1" }));
    });

    it("returns undefined and warns when Stripe reports the method missing", async () => {
      const { service, stripe, paymentMethodRepository, logger } = setup();
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(generateDatabasePaymentMethod({ paymentMethodId: "pm_1", isDefault: true }));
      vi.spyOn(stripe.paymentMethods, "retrieve").mockRejectedValue(resourceMissingError());

      const result = await service.getDefaultPaymentMethod(user(), ability);

      expect(result).toBeUndefined();
      expect(paymentMethodRepository.deleteByFingerprint).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "DEFAULT_PAYMENT_METHOD_NOT_ATTACHED", paymentMethodId: "pm_1" }));
    });

    it("rethrows other Stripe errors", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(generateDatabasePaymentMethod({ paymentMethodId: "pm_1", isDefault: true }));
      vi.spyOn(stripe.paymentMethods, "retrieve").mockRejectedValue(new Error("stripe unavailable"));

      await expect(service.getDefaultPaymentMethod(user(), ability)).rejects.toThrow("stripe unavailable");
    });
  });

  describe("hasPaymentMethod", () => {
    it("returns true when the method belongs to the user's customer", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(asResponse(generatePaymentMethod({ customer: "cus_1" })));

      expect(await service.hasPaymentMethod("pm_1", mock<UserOutput>({ stripeCustomerId: "cus_1" }))).toBe(true);
    });

    it("returns false when the method belongs to a different customer", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(asResponse(generatePaymentMethod({ customer: "cus_other" })));

      expect(await service.hasPaymentMethod("pm_1", mock<UserOutput>({ stripeCustomerId: "cus_1" }))).toBe(false);
    });

    it("returns false when Stripe reports the method is missing", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.paymentMethods, "retrieve").mockRejectedValue(resourceMissingError());

      expect(await service.hasPaymentMethod("pm_missing", mock<UserOutput>({ stripeCustomerId: "cus_1" }))).toBe(false);
    });
  });

  describe("isDefaultPaymentMethod", () => {
    it("returns true when the local record is the default", async () => {
      const { service, paymentMethodRepository } = setup();
      paymentMethodRepository.findOneBy.mockResolvedValue(generateDatabasePaymentMethod({ paymentMethodId: "pm_1", isDefault: true }));

      expect(await service.isDefaultPaymentMethod("pm_1", "user_1")).toBe(true);
      expect(paymentMethodRepository.findOneBy).toHaveBeenCalledWith({ userId: "user_1", paymentMethodId: "pm_1" });
    });

    it("returns false when the local record is not the default", async () => {
      const { service, paymentMethodRepository } = setup();
      paymentMethodRepository.findOneBy.mockResolvedValue(generateDatabasePaymentMethod({ paymentMethodId: "pm_1", isDefault: false }));

      expect(await service.isDefaultPaymentMethod("pm_1", "user_1")).toBe(false);
    });

    it("returns false when there is no local record", async () => {
      const { service, paymentMethodRepository } = setup();
      paymentMethodRepository.findOneBy.mockResolvedValue(undefined);

      expect(await service.isDefaultPaymentMethod("pm_1", "user_1")).toBe(false);
    });
  });

  describe("validatePaymentMethodAfter3DS", () => {
    const CUSTOMER_ID = "cus_123";
    const PAYMENT_METHOD_ID = "pm_123";
    const PAYMENT_INTENT_ID = "pi_123";

    const givenPaymentIntent = (overrides: Partial<Stripe.PaymentIntent>) =>
      asResponse(mock<Stripe.PaymentIntent>({ id: PAYMENT_INTENT_ID, customer: CUSTOMER_ID, payment_method: PAYMENT_METHOD_ID, ...overrides }));

    it("marks the payment method as validated when the intent succeeded", async () => {
      const { service, stripe, paymentMethodRepository, userRepository } = setup();
      userRepository.findOneBy.mockResolvedValue(mock<UserOutput>({ id: "user_123", stripeCustomerId: CUSTOMER_ID }));
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(givenPaymentIntent({ status: "succeeded" }));

      const result = await service.validatePaymentMethodAfter3DS(CUSTOMER_ID, PAYMENT_METHOD_ID, PAYMENT_INTENT_ID);

      expect(result).toEqual({ success: true });
      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(PAYMENT_INTENT_ID);
      expect(paymentMethodRepository.markAsValidated).toHaveBeenCalledWith(PAYMENT_METHOD_ID, "user_123");
    });

    it("marks the payment method as validated when the intent requires capture", async () => {
      const { service, stripe, paymentMethodRepository, userRepository } = setup();
      userRepository.findOneBy.mockResolvedValue(mock<UserOutput>({ id: "user_123", stripeCustomerId: CUSTOMER_ID }));
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(givenPaymentIntent({ status: "requires_capture" }));

      const result = await service.validatePaymentMethodAfter3DS(CUSTOMER_ID, PAYMENT_METHOD_ID, PAYMENT_INTENT_ID);

      expect(result).toEqual({ success: true });
      expect(paymentMethodRepository.markAsValidated).toHaveBeenCalledWith(PAYMENT_METHOD_ID, "user_123");
    });

    it("returns success false without validating when the intent is not successful", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(givenPaymentIntent({ status: "requires_payment_method" }));

      const result = await service.validatePaymentMethodAfter3DS(CUSTOMER_ID, PAYMENT_METHOD_ID, PAYMENT_INTENT_ID);

      expect(result).toEqual({ success: false });
      expect(paymentMethodRepository.markAsValidated).not.toHaveBeenCalled();
    });

    it("returns success without marking when no user matches the customer", async () => {
      const { service, stripe, paymentMethodRepository, userRepository } = setup();
      userRepository.findOneBy.mockResolvedValue(undefined);
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(givenPaymentIntent({ status: "succeeded" }));

      const result = await service.validatePaymentMethodAfter3DS(CUSTOMER_ID, PAYMENT_METHOD_ID, PAYMENT_INTENT_ID);

      expect(result).toEqual({ success: true });
      expect(paymentMethodRepository.markAsValidated).not.toHaveBeenCalled();
    });

    it("propagates the failure when persisting the validation throws", async () => {
      const { service, stripe, paymentMethodRepository, userRepository } = setup();
      userRepository.findOneBy.mockResolvedValue(mock<UserOutput>({ id: "user_123", stripeCustomerId: CUSTOMER_ID }));
      paymentMethodRepository.markAsValidated.mockRejectedValue(new Error("db unavailable"));
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(givenPaymentIntent({ status: "succeeded" }));

      await expect(service.validatePaymentMethodAfter3DS(CUSTOMER_ID, PAYMENT_METHOD_ID, PAYMENT_INTENT_ID)).rejects.toThrow("db unavailable");
    });

    it("rethrows when the payment intent cannot be retrieved", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.paymentIntents, "retrieve").mockRejectedValue(new Error("Payment intent not found"));

      await expect(service.validatePaymentMethodAfter3DS(CUSTOMER_ID, PAYMENT_METHOD_ID, PAYMENT_INTENT_ID)).rejects.toThrow("Payment intent not found");
    });

    it("rejects when the intent belongs to a different customer", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(givenPaymentIntent({ status: "succeeded", customer: "cus_other" }));

      await expect(service.validatePaymentMethodAfter3DS(CUSTOMER_ID, PAYMENT_METHOD_ID, PAYMENT_INTENT_ID)).rejects.toThrow(
        "Payment intent does not belong to the user"
      );
    });

    it("rejects when the intent references a different payment method", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(givenPaymentIntent({ status: "succeeded", payment_method: "pm_other" }));

      await expect(service.validatePaymentMethodAfter3DS(CUSTOMER_ID, PAYMENT_METHOD_ID, PAYMENT_INTENT_ID)).rejects.toThrow(
        "Payment intent does not reference the provided payment method"
      );
    });
  });

  function setup() {
    const paymentMethodRepository = mock<PaymentMethodRepository>();
    paymentMethodRepository.accessibleBy.mockReturnValue(paymentMethodRepository);
    const userRepository = mock<UserRepository>();
    const autoReloadPauseService = mock<AutoReloadPauseService>();
    const logger = mock<LoggerService>();

    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });

    const service = new PaymentMethodService(stripe, paymentMethodRepository, userRepository, autoReloadPauseService, () => logger);

    return { service, stripe, paymentMethodRepository, userRepository, autoReloadPauseService, logger };
  }
});
