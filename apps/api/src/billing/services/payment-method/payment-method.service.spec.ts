import type { LoggerService } from "@akashnetwork/logging";
import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PaymentMethodRepository } from "@src/billing/repositories";
import type { PayingUser } from "@src/billing/services/paying-user/paying-user";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { PaymentMethodService } from "./payment-method.service";

import { generateDatabasePaymentMethod } from "@test/seeders/database-payment-method.seeder";
import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { TEST_CONSTANTS } from "@test/seeders/stripe-test-data.seeder";

const ability = createMongoAbility([{ action: "manage", subject: "all" }]);
const asResponse = <T>(value: T) => value as unknown as Stripe.Response<T>;

describe(PaymentMethodService.name, () => {
  describe("getPaymentMethods", () => {
    it("returns remote methods merged with local validated/default flags, newest first", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const newer = generatePaymentMethod({ id: TEST_CONSTANTS.PAYMENT_METHOD_ID, created: 1757992768, card: { fingerprint: "fp_a" } });
      const older = generatePaymentMethod({ id: "pm_456", created: 1757991776, card: { fingerprint: "fp_b" } });
      vi.spyOn(stripe.paymentMethods, "list").mockResolvedValue({ data: [older, newer] } as unknown as Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>);
      paymentMethodRepository.findByUserId.mockResolvedValue([]);

      const result = await service.getPaymentMethods(TEST_CONSTANTS.USER_ID, TEST_CONSTANTS.CUSTOMER_ID, ability);

      expect(stripe.paymentMethods.list).toHaveBeenCalledWith({ customer: TEST_CONSTANTS.CUSTOMER_ID });
      expect(result).toEqual([
        { ...newer, validated: false, isDefault: false },
        { ...older, validated: false, isDefault: false }
      ]);
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

  function setup() {
    const paymentMethodRepository = mock<PaymentMethodRepository>();
    paymentMethodRepository.accessibleBy.mockReturnValue(paymentMethodRepository);

    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });

    const service = new PaymentMethodService(stripe, paymentMethodRepository, () => mock<LoggerService>());

    return { service, stripe, paymentMethodRepository };
  }
});
