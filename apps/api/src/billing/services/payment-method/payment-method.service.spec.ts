import type { LoggerService } from "@akashnetwork/logging";
import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PaymentMethodRepository } from "@src/billing/repositories";
import type { PayingUser } from "@src/billing/services/paying-user/paying-user";
import type { UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import { PaymentMethodService } from "./payment-method.service";

import { generateDatabasePaymentMethod } from "@test/seeders/database-payment-method.seeder";
import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { TEST_CONSTANTS } from "@test/seeders/stripe-test-data.seeder";

const ability = createMongoAbility([{ action: "manage", subject: "all" }]);
const asResponse = <T>(value: T) => value as unknown as Stripe.Response<T>;

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
    it("merges the remote default with the local record", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const remote = generatePaymentMethod({ id: "pm_default" });
      const local = generateDatabasePaymentMethod({ paymentMethodId: "pm_default" });
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue({
        invoice_settings: { default_payment_method: remote }
      } as unknown as Stripe.Response<Stripe.Customer>);
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(local);

      const result = await service.getDefaultPaymentMethod(mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" }), ability);

      expect(result).toEqual({ ...remote, validated: local.isValidated, isDefault: local.isDefault });
    });

    it("returns undefined when there is no local record for the remote default", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue({
        invoice_settings: { default_payment_method: generatePaymentMethod() }
      } as unknown as Stripe.Response<Stripe.Customer>);
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(undefined);

      expect(await service.getDefaultPaymentMethod(mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" }), ability)).toBeUndefined();
    });

    it("re-pushes the local default to Stripe when the remote default is missing", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const local = generateDatabasePaymentMethod({ paymentMethodId: "pm_1", fingerprint: "fp_1" });
      const remotePaymentMethod = generatePaymentMethod({ id: "pm_1", customer: "cus_1" });
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue({
        invoice_settings: { default_payment_method: null }
      } as unknown as Stripe.Response<Stripe.Customer>);
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(local);
      const retrieve = vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(asResponse(remotePaymentMethod));
      const update = vi.spyOn(stripe.customers, "update").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>());

      const result = await service.getDefaultPaymentMethod(mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" }), ability);

      expect(retrieve).toHaveBeenCalledWith("pm_1", undefined, { timeout: 3_000 });
      expect(update).toHaveBeenCalledWith("cus_1", { invoice_settings: { default_payment_method: "pm_1" } }, { timeout: 3_000 });
      expect(result).toEqual({ ...remotePaymentMethod, validated: local.isValidated, isDefault: local.isDefault });
    });

    it("realigns Stripe to the local default when the remote default is a different method", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const local = generateDatabasePaymentMethod({ paymentMethodId: "pm_1", fingerprint: "fp_1" });
      const remotePaymentMethod = generatePaymentMethod({ id: "pm_1", customer: "cus_1" });
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue({
        invoice_settings: { default_payment_method: generatePaymentMethod({ id: "pm_other" }) }
      } as unknown as Stripe.Response<Stripe.Customer>);
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(local);
      vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(asResponse(remotePaymentMethod));
      const update = vi.spyOn(stripe.customers, "update").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>());

      const result = await service.getDefaultPaymentMethod(mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" }), ability);

      expect(update).toHaveBeenCalledWith("cus_1", { invoice_settings: { default_payment_method: "pm_1" } }, { timeout: 3_000 });
      expect(result).toEqual({ ...remotePaymentMethod, validated: local.isValidated, isDefault: local.isDefault });
    });

    it("removes the stale local default and returns undefined when the card is detached", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const local = generateDatabasePaymentMethod({ paymentMethodId: "pm_1", fingerprint: "fp_1" });
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue({
        invoice_settings: { default_payment_method: null }
      } as unknown as Stripe.Response<Stripe.Customer>);
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(local);
      vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(asResponse(generatePaymentMethod({ id: "pm_1", customer: null })));

      const result = await service.getDefaultPaymentMethod(mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" }), ability);

      expect(paymentMethodRepository.deleteByFingerprint).toHaveBeenCalledWith("fp_1", "pm_1", "user_1");
      expect(result).toBeUndefined();
    });

    it("removes the stale local default and returns undefined when Stripe reports the card is missing", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const local = generateDatabasePaymentMethod({ paymentMethodId: "pm_1", fingerprint: "fp_1" });
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue({
        invoice_settings: { default_payment_method: null }
      } as unknown as Stripe.Response<Stripe.Customer>);
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(local);
      vi.spyOn(stripe.paymentMethods, "retrieve").mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({
          type: "invalid_request_error",
          code: "resource_missing",
          message: "No such PaymentMethod"
        } as Stripe.StripeRawError)
      );

      const result = await service.getDefaultPaymentMethod(mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" }), ability);

      expect(paymentMethodRepository.deleteByFingerprint).toHaveBeenCalledWith("fp_1", "pm_1", "user_1");
      expect(result).toBeUndefined();
    });

    it("returns undefined without throwing when removing the stale local default fails", async () => {
      const { service, stripe, paymentMethodRepository, logger } = setup();
      const local = generateDatabasePaymentMethod({ paymentMethodId: "pm_1", fingerprint: "fp_1" });
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue({
        invoice_settings: { default_payment_method: null }
      } as unknown as Stripe.Response<Stripe.Customer>);
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(local);
      vi.spyOn(stripe.paymentMethods, "retrieve").mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({
          type: "invalid_request_error",
          code: "resource_missing",
          message: "No such PaymentMethod"
        } as Stripe.StripeRawError)
      );
      paymentMethodRepository.deleteByFingerprint.mockRejectedValue(new Error("db unavailable"));

      const result = await service.getDefaultPaymentMethod(mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" }), ability);

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "DEFAULT_PAYMENT_METHOD_STALE_REMOVE_FAILED", paymentMethodId: "pm_1" }));
    });

    it("returns undefined without removing the local default when the Stripe push fails", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const local = generateDatabasePaymentMethod({ paymentMethodId: "pm_1", fingerprint: "fp_1" });
      vi.spyOn(stripe.customers, "retrieve").mockResolvedValue({
        invoice_settings: { default_payment_method: null }
      } as unknown as Stripe.Response<Stripe.Customer>);
      paymentMethodRepository.findDefaultByUserId.mockResolvedValue(local);
      vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(asResponse(generatePaymentMethod({ id: "pm_1", customer: "cus_1" })));
      vi.spyOn(stripe.customers, "update").mockRejectedValue(new Error("stripe unavailable"));

      const result = await service.getDefaultPaymentMethod(mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" }), ability);

      expect(paymentMethodRepository.deleteByFingerprint).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
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
      vi.spyOn(stripe.paymentMethods, "retrieve").mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({
          type: "invalid_request_error",
          code: "resource_missing",
          message: "No such PaymentMethod"
        } as Stripe.StripeRawError)
      );

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
    const logger = mock<LoggerService>();

    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });

    const service = new PaymentMethodService(stripe, paymentMethodRepository, userRepository, () => logger);

    return { service, stripe, paymentMethodRepository, userRepository, logger };
  }
});
