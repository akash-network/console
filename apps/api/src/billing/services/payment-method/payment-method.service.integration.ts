import type { LoggerService } from "@akashnetwork/logging";
import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PaymentMethodRepository } from "@src/billing/repositories";
import type { PayingUser } from "@src/billing/services/paying-user/paying-user";
import { PaymentMethodService } from "./payment-method.service";

import { generateDatabasePaymentMethod } from "@test/seeders/database-payment-method.seeder";
import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";

/**
 * These cover the `@WithTransaction` methods, which open a real DB transaction and so can't run as
 * unit specs — they live here (DB-backed `integration` project). The repository is still mocked;
 * only the transaction wrapper needs the database.
 */
const ability = createMongoAbility([{ action: "manage", subject: "all" }]);
const asPaymentMethodResponse = (paymentMethod: Stripe.PaymentMethod) => paymentMethod as unknown as Stripe.Response<Stripe.PaymentMethod>;

describe(PaymentMethodService.name, () => {
  describe("markPaymentMethodAsDefault", () => {
    it("sets an already-synced method as default locally and on Stripe", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const user = mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" });
      const local = generateDatabasePaymentMethod({ paymentMethodId: "pm_1" });
      const remote = generatePaymentMethod({ id: "pm_1" });
      paymentMethodRepository.markAsDefault.mockResolvedValue(local);
      vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(asPaymentMethodResponse(remote));
      const update = vi.spyOn(stripe.customers, "update").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>());

      const result = await service.markPaymentMethodAsDefault("pm_1", user, ability);

      expect(update).toHaveBeenCalledWith("cus_1", { invoice_settings: { default_payment_method: "pm_1" } }, { timeout: 3_000 });
      expect(paymentMethodRepository.createAsDefault).not.toHaveBeenCalled();
      expect(result).toEqual({ ...remote, validated: local.isValidated, isDefault: local.isDefault });
    });

    it("creates a local record for an unsynced method, then sets it as default", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const user = mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" });
      const remote = generatePaymentMethod({ id: "pm_1", card: { fingerprint: "fp_1" } });
      const created = generateDatabasePaymentMethod({ paymentMethodId: "pm_1", fingerprint: "fp_1" });
      paymentMethodRepository.markAsDefault.mockResolvedValue(undefined);
      paymentMethodRepository.createAsDefault.mockResolvedValue(created);
      vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(asPaymentMethodResponse(remote));
      vi.spyOn(stripe.customers, "update").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>());

      const result = await service.markPaymentMethodAsDefault("pm_1", user, ability);

      expect(paymentMethodRepository.createAsDefault).toHaveBeenCalledWith({ userId: "user_1", fingerprint: "fp_1", paymentMethodId: "pm_1" });
      expect(result).toEqual({ ...remote, validated: created.isValidated, isDefault: created.isDefault });
    });

    it("rejects with 403 when an unsynced method has no identifiable fingerprint", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const user = mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" });
      paymentMethodRepository.markAsDefault.mockResolvedValue(undefined);
      const remote = generatePaymentMethod({ type: "us_bank_account", card: null } as unknown as Parameters<typeof generatePaymentMethod>[0]);
      vi.spyOn(stripe.paymentMethods, "retrieve").mockResolvedValue(asPaymentMethodResponse(remote));

      await expect(service.markPaymentMethodAsDefault("pm_1", user, ability)).rejects.toMatchObject({ status: 403 });
      expect(paymentMethodRepository.createAsDefault).not.toHaveBeenCalled();
    });
  });

  describe("syncAttached", () => {
    it("upserts and marks a newly created default method as default on Stripe", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const user = mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" });
      const paymentMethod = generatePaymentMethod({ id: "pm_1", card: { fingerprint: "fp_1" } });
      const local = { ...generateDatabasePaymentMethod({ paymentMethodId: "pm_1" }), isDefault: true };
      paymentMethodRepository.upsert.mockResolvedValue({ paymentMethod: local, isNew: true });
      const update = vi.spyOn(stripe.customers, "update").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>());

      const result = await service.syncAttached({ user, paymentMethod });

      expect(paymentMethodRepository.upsert).toHaveBeenCalledWith({ userId: "user_1", fingerprint: "fp_1", paymentMethodId: "pm_1" });
      expect(update).toHaveBeenCalledWith("cus_1", { invoice_settings: { default_payment_method: "pm_1" } }, { timeout: 3_000 });
      expect(result).toEqual({ isNew: true, isDefault: true });
    });

    it("upserts without a remote default sync for an already-synced method", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const user = mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" });
      const paymentMethod = generatePaymentMethod({ id: "pm_1", card: { fingerprint: "fp_1" } });
      const local = { ...generateDatabasePaymentMethod({ paymentMethodId: "pm_1" }), isDefault: true };
      paymentMethodRepository.upsert.mockResolvedValue({ paymentMethod: local, isNew: false });
      const update = vi.spyOn(stripe.customers, "update").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>());

      const result = await service.syncAttached({ user, paymentMethod });

      expect(update).not.toHaveBeenCalled();
      expect(result).toEqual({ isNew: false, isDefault: true });
    });

    it("skips the upsert when the payment method has no fingerprint", async () => {
      const { service, paymentMethodRepository } = setup();
      const user = mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" });
      const paymentMethod = generatePaymentMethod({ type: "us_bank_account", card: null } as unknown as Parameters<typeof generatePaymentMethod>[0]);

      const result = await service.syncAttached({ user, paymentMethod });

      expect(paymentMethodRepository.upsert).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe("removeDetached", () => {
    it("deletes the local record by fingerprint", async () => {
      const { service, paymentMethodRepository } = setup();
      const paymentMethod = generatePaymentMethod({ id: "pm_1", card: { fingerprint: "fp_1" } });
      paymentMethodRepository.deleteByFingerprint.mockResolvedValue(generateDatabasePaymentMethod({ paymentMethodId: "pm_1" }));

      const result = await service.removeDetached({ userId: "user_1", paymentMethod });

      expect(paymentMethodRepository.deleteByFingerprint).toHaveBeenCalledWith("fp_1", "pm_1", "user_1");
      expect(result).toBe(true);
    });

    it("skips the delete when the payment method has no fingerprint", async () => {
      const { service, paymentMethodRepository } = setup();
      const paymentMethod = generatePaymentMethod({ type: "us_bank_account", card: null } as unknown as Parameters<typeof generatePaymentMethod>[0]);

      const result = await service.removeDetached({ userId: "user_1", paymentMethod });

      expect(paymentMethodRepository.deleteByFingerprint).not.toHaveBeenCalled();
      expect(result).toBe(false);
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
