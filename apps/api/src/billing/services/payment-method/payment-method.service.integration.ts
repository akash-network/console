import type { LoggerService } from "@akashnetwork/logging";
import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PaymentMethodRepository } from "@src/billing/repositories";
import type { PayingUser } from "@src/billing/services/paying-user/paying-user";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import { PaymentMethodService } from "./payment-method.service";

import { generateDatabasePaymentMethod } from "@test/seeders/database-payment-method.seeder";
import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { createTestUser } from "@test/seeders/user-test.seeder";

/**
 * These cover the `@WithTransaction` methods, which open a real DB transaction and so can't run as
 * unit specs — they live here (DB-backed `integration` project). The repository is still mocked;
 * only the transaction wrapper needs the database.
 */
const ability = createMongoAbility([{ action: "manage", subject: "all" }]);
const asPaymentMethodResponse = (paymentMethod: Stripe.PaymentMethod) => paymentMethod as unknown as Stripe.Response<Stripe.PaymentMethod>;

describe(PaymentMethodService.name, () => {
  describe("getPaymentMethods", () => {
    const payingUser = () => mock<PayingUser>({ id: "user_1", stripeCustomerId: "cus_1" });
    const listResponse = (data: Stripe.PaymentMethod[]) => ({ data, has_more: false }) as unknown as Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>;

    it("repairs an unsynced remote method by syncing it and pushing the Stripe default", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const remote = generatePaymentMethod({ id: "pm_1", card: { fingerprint: "fp_1" } });
      const healed = { ...generateDatabasePaymentMethod({ paymentMethodId: "pm_1", fingerprint: "fp_1" }), isDefault: true };
      vi.spyOn(stripe.paymentMethods, "list").mockResolvedValue(listResponse([remote]));
      paymentMethodRepository.findByUserId.mockResolvedValueOnce([]).mockResolvedValueOnce([healed]);
      paymentMethodRepository.upsert.mockResolvedValue({ paymentMethod: healed, isNew: true });
      const update = vi.spyOn(stripe.customers, "update").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>());

      const result = await service.getPaymentMethods(payingUser(), ability);

      expect(paymentMethodRepository.upsert).toHaveBeenCalledWith({ userId: "user_1", fingerprint: "fp_1", paymentMethodId: "pm_1" });
      expect(update).toHaveBeenCalledWith("cus_1", { invoice_settings: { default_payment_method: "pm_1" } }, { timeout: 3_000 });
      expect(result).toEqual([{ ...remote, validated: false, isDefault: true }]);
    });

    it("repairs multiple unsynced remote methods oldest first", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const older = generatePaymentMethod({ id: "pm_old", created: 100, card: { fingerprint: "fp_old" } });
      const newer = generatePaymentMethod({ id: "pm_new", created: 200, card: { fingerprint: "fp_new" } });
      vi.spyOn(stripe.paymentMethods, "list").mockResolvedValue(listResponse([newer, older]));
      paymentMethodRepository.findByUserId.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      paymentMethodRepository.upsert.mockResolvedValue({ paymentMethod: generateDatabasePaymentMethod({ paymentMethodId: "pm_old" }), isNew: true });
      vi.spyOn(stripe.customers, "update").mockResolvedValue(mock<Stripe.Response<Stripe.Customer>>());

      await service.getPaymentMethods(payingUser(), ability);

      expect(paymentMethodRepository.upsert).toHaveBeenNthCalledWith(1, { userId: "user_1", fingerprint: "fp_old", paymentMethodId: "pm_old" });
      expect(paymentMethodRepository.upsert).toHaveBeenNthCalledWith(2, { userId: "user_1", fingerprint: "fp_new", paymentMethodId: "pm_new" });
    });

    it("returns the merged list when a repair fails", async () => {
      const { service, stripe, paymentMethodRepository } = setup();
      const remote = generatePaymentMethod({ id: "pm_1", card: { fingerprint: "fp_1" } });
      vi.spyOn(stripe.paymentMethods, "list").mockResolvedValue(listResponse([remote]));
      paymentMethodRepository.findByUserId.mockResolvedValue([]);
      paymentMethodRepository.upsert.mockRejectedValue(new Error("db unavailable"));

      const result = await service.getPaymentMethods(payingUser(), ability);

      expect(result).toEqual([{ ...remote, validated: false, isDefault: false }]);
    });
  });

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

  describe("syncAttachedFromEvent", () => {
    it("resolves the paying user and upserts the attached payment method", async () => {
      const { service, paymentMethodRepository, userRepository } = setup();
      const mockUser = createTestUser({ stripeCustomerId: "cus_123" });
      userRepository.findOneBy.mockResolvedValue(mockUser);
      paymentMethodRepository.upsert.mockResolvedValue({
        paymentMethod: { ...generateDatabasePaymentMethod({ paymentMethodId: "pm_1" }), isDefault: false },
        isNew: true
      });

      await service.syncAttachedFromEvent(createPaymentMethodAttachedEvent({ id: "pm_1", customer: "cus_123", fingerprint: "fp_1" }));

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_123" });
      expect(paymentMethodRepository.upsert).toHaveBeenCalledWith({ userId: mockUser.id, fingerprint: "fp_1", paymentMethodId: "pm_1" });
    });

    it("returns early without resolving the user when the customer id is missing", async () => {
      const { service, paymentMethodRepository, userRepository } = setup();

      await service.syncAttachedFromEvent(createPaymentMethodAttachedEvent({ id: "pm_1", customer: null, fingerprint: "fp_1" }));

      expect(userRepository.findOneBy).not.toHaveBeenCalled();
      expect(paymentMethodRepository.upsert).not.toHaveBeenCalled();
    });

    it("returns early without upserting when the user is not found", async () => {
      const { service, paymentMethodRepository, userRepository } = setup();
      userRepository.findOneBy.mockResolvedValue(undefined);

      await service.syncAttachedFromEvent(createPaymentMethodAttachedEvent({ id: "pm_1", customer: "cus_unknown", fingerprint: "fp_1" }));

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_unknown" });
      expect(paymentMethodRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe("removeDetachedFromEvent", () => {
    it("resolves the user and deletes the local record for a known customer", async () => {
      const { service, paymentMethodRepository, userRepository } = setup();
      const mockUser = createTestUser({ stripeCustomerId: "cus_123" });
      userRepository.findOneBy.mockResolvedValue(mockUser);
      paymentMethodRepository.deleteByFingerprint.mockResolvedValue(generateDatabasePaymentMethod({ paymentMethodId: "pm_1" }));

      await service.removeDetachedFromEvent(createPaymentMethodDetachedEvent({ id: "pm_1", customer: "cus_123", fingerprint: "fp_1" }));

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ stripeCustomerId: "cus_123" });
      expect(paymentMethodRepository.deleteByFingerprint).toHaveBeenCalledWith("fp_1", "pm_1", mockUser.id);
    });

    it("returns early without deleting when the user is not found", async () => {
      const { service, paymentMethodRepository, userRepository } = setup();
      userRepository.findOneBy.mockResolvedValue(undefined);

      await service.removeDetachedFromEvent(createPaymentMethodDetachedEvent({ id: "pm_1", customer: "cus_unknown", fingerprint: "fp_1" }));

      expect(paymentMethodRepository.deleteByFingerprint).not.toHaveBeenCalled();
    });
  });

  function setup() {
    const paymentMethodRepository = mock<PaymentMethodRepository>();
    paymentMethodRepository.accessibleBy.mockReturnValue(paymentMethodRepository);
    const userRepository = mock<UserRepository>();

    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });

    const service = new PaymentMethodService(stripe, paymentMethodRepository, userRepository, () => mock<LoggerService>());

    return { service, stripe, paymentMethodRepository, userRepository };
  }

  function createPaymentMethodAttachedEvent(params: { id: string; customer: string | null; fingerprint?: string }): Stripe.PaymentMethodAttachedEvent {
    return {
      id: "evt_1",
      type: "payment_method.attached",
      data: {
        object: { id: params.id, customer: params.customer, type: "card", card: { fingerprint: params.fingerprint ?? "fp_abc" } } as Stripe.PaymentMethod
      }
    } as Stripe.PaymentMethodAttachedEvent;
  }

  function createPaymentMethodDetachedEvent(params: { id: string; customer: string | null; fingerprint?: string }): Stripe.PaymentMethodDetachedEvent {
    return {
      id: "evt_1",
      type: "payment_method.detached",
      data: {
        object: { id: params.id, customer: params.customer, type: "card", card: { fingerprint: params.fingerprint ?? "fp_abc" } } as Stripe.PaymentMethod
      }
    } as Stripe.PaymentMethodDetachedEvent;
  }
});
