import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { UserRepository } from "@src/user/repositories";
import { type StripeTransactionInput, StripeTransactionRepository } from "./stripe-transaction.repository";

describe(StripeTransactionRepository.name, () => {
  describe("findByChargeIds", () => {
    it("returns transactions matching the given charge ids with their bonus amounts", async () => {
      const { stripeTransactionRepository, createTestTransaction } = setup();
      const chargeId1 = `ch_${faker.string.alphanumeric(24)}`;
      const chargeId2 = `ch_${faker.string.alphanumeric(24)}`;
      await createTestTransaction({ stripeChargeId: chargeId1, bonusAmount: 1000 });
      await createTestTransaction({ stripeChargeId: chargeId2, bonusAmount: 0 });

      const result = await stripeTransactionRepository.findByChargeIds([chargeId1, chargeId2]);

      expect(result).toHaveLength(2);
      expect(result.find(transaction => transaction.stripeChargeId === chargeId1)?.bonusAmount).toBe(1000);
      expect(result.find(transaction => transaction.stripeChargeId === chargeId2)?.bonusAmount).toBe(0);
    });

    it("returns only the transactions whose charge ids are requested", async () => {
      const { stripeTransactionRepository, createTestTransaction } = setup();
      const chargeId = `ch_${faker.string.alphanumeric(24)}`;
      await createTestTransaction({ stripeChargeId: chargeId });
      await createTestTransaction({ stripeChargeId: `ch_${faker.string.alphanumeric(24)}` });

      const result = await stripeTransactionRepository.findByChargeIds([chargeId]);

      expect(result).toHaveLength(1);
      expect(result[0].stripeChargeId).toBe(chargeId);
    });

    it("returns an empty array when no charge ids are provided", async () => {
      const { stripeTransactionRepository } = setup();

      const result = await stripeTransactionRepository.findByChargeIds([]);

      expect(result).toEqual([]);
    });
  });

  // The partial unique index on stripe_invoice_id (WHERE NOT NULL) is the one-row-per-invoice
  // invariant that both the coupon path and the admin manual-credit path rely on.
  describe("stripe_invoice_id partial unique index", () => {
    it("rejects a second transaction with the same stripe invoice id", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const invoiceId = `in_${faker.string.alphanumeric(12)}`;

      await stripeTransactionRepository.create({
        userId: user.id,
        type: "manual_credit",
        status: "pending",
        amount: 50000,
        currency: "usd",
        stripeInvoiceId: invoiceId
      });

      await expect(
        stripeTransactionRepository.create({
          userId: user.id,
          type: "manual_credit",
          status: "pending",
          amount: 99999,
          currency: "usd",
          stripeInvoiceId: invoiceId
        })
      ).rejects.toThrow();
    });

    it("allows multiple transactions with a null stripe invoice id", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();

      const first = await stripeTransactionRepository.create({
        userId: user.id,
        type: "payment_intent",
        status: "succeeded",
        amount: 1000,
        currency: "usd",
        stripeInvoiceId: null
      });

      const second = await stripeTransactionRepository.create({
        userId: user.id,
        type: "payment_intent",
        status: "succeeded",
        amount: 2000,
        currency: "usd",
        stripeInvoiceId: null
      });

      expect(first.id).not.toBe(second.id);
    });
  });

  describe("findOrCreateByIdempotencyKey", () => {
    it("creates the row on first use of a key", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const key = `topup_${user.id}_${faker.string.uuid()}`;

      const result = await stripeTransactionRepository.findOrCreateByIdempotencyKey(keyedTransactionInput(user.id, key));

      expect(result.isNew).toBe(true);
      expect(result.transaction.stripeIdempotencyKey).toBe(key);
      expect(await stripeTransactionRepository.findById(result.transaction.id)).toMatchObject({ stripeIdempotencyKey: key, amount: 10000 });
    });

    it("returns the existing row without creating another on a reused key", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const key = `topup_${user.id}_${faker.string.uuid()}`;

      const first = await stripeTransactionRepository.findOrCreateByIdempotencyKey(keyedTransactionInput(user.id, key));
      const second = await stripeTransactionRepository.findOrCreateByIdempotencyKey(keyedTransactionInput(user.id, key));

      expect(second.isNew).toBe(false);
      expect(second.transaction.id).toBe(first.transaction.id);
      expect(await stripeTransactionRepository.find({ userId: user.id })).toHaveLength(1);
    });

    it("resolves a concurrent insert race to a single row", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const key = `topup_${user.id}_${faker.string.uuid()}`;

      const [first, second] = await Promise.all([
        stripeTransactionRepository.findOrCreateByIdempotencyKey(keyedTransactionInput(user.id, key)),
        stripeTransactionRepository.findOrCreateByIdempotencyKey(keyedTransactionInput(user.id, key))
      ]);

      expect(first.transaction.id).toBe(second.transaction.id);
      expect([first.isNew, second.isNew].filter(Boolean)).toHaveLength(1);
      expect(await stripeTransactionRepository.find({ userId: user.id })).toHaveLength(1);
    });

    it("allows multiple rows with a null idempotency key", async () => {
      const { createTestTransaction } = setup();

      const first = await createTestTransaction({ stripeIdempotencyKey: null });
      const second = await createTestTransaction({ stripeIdempotencyKey: null });

      expect(first.id).not.toBe(second.id);
    });

    function keyedTransactionInput(userId: string, stripeIdempotencyKey: string): StripeTransactionInput & { stripeIdempotencyKey: string } {
      return {
        userId,
        type: "payment_intent",
        status: "created",
        amount: 10000,
        currency: "usd",
        stripeIdempotencyKey
      };
    }
  });

  describe("updateByIdUnlessSettled", () => {
    it("updates an unsettled row and returns it", async () => {
      const { stripeTransactionRepository, createTestTransaction } = setup();
      const transaction = await createTestTransaction({ status: "created" });

      const updated = await stripeTransactionRepository.updateByIdUnlessSettled(transaction.id, { status: "pending", stripePaymentIntentId: "pi_1" });

      expect(updated).toMatchObject({ id: transaction.id, status: "pending", stripePaymentIntentId: "pi_1" });
    });

    it("updates a failed row so a retried attempt can resume it", async () => {
      const { stripeTransactionRepository, createTestTransaction } = setup();
      const transaction = await createTestTransaction({ status: "failed" });

      const updated = await stripeTransactionRepository.updateByIdUnlessSettled(transaction.id, { status: "requires_action" });

      expect(updated).toMatchObject({ id: transaction.id, status: "requires_action" });
    });

    it.each(["succeeded", "refunded"] as const)("suppresses writes to a %s row", async status => {
      const { stripeTransactionRepository, createTestTransaction } = setup();
      const transaction = await createTestTransaction({ status });

      const updated = await stripeTransactionRepository.updateByIdUnlessSettled(transaction.id, { status: "failed", errorMessage: "stale replay" });

      expect(updated).toBeUndefined();
      expect(await stripeTransactionRepository.findById(transaction.id)).toMatchObject({ status, errorMessage: null });
    });
  });

  let cleanup: () => Promise<void>;
  afterEach(async () => {
    await cleanup?.();
  });

  function setup() {
    const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
    const userRepository = container.resolve(UserRepository);
    const createdUserIds: string[] = [];
    let testUserId: string | undefined;

    cleanup = async () => {
      if (createdUserIds.length > 0) {
        await userRepository.deleteById(createdUserIds);
      }
    };

    // Deleting the user cascades to its stripe transactions, so tracking users is enough for cleanup.
    async function getTestUserId() {
      if (!testUserId) {
        const user = await userRepository.create({});
        createdUserIds.push(user.id);
        testUserId = user.id;
      }
      return testUserId;
    }

    async function createTestTransaction(overrides: Partial<StripeTransactionInput> = {}) {
      return stripeTransactionRepository.create({
        userId: await getTestUserId(),
        type: "payment_intent",
        status: "succeeded",
        amount: faker.number.int({ min: 1000, max: 100000 }),
        currency: "usd",
        ...overrides
      });
    }

    async function createTestUser() {
      const user = await userRepository.create({});
      createdUserIds.push(user.id);
      return user;
    }

    return { stripeTransactionRepository, userRepository, createTestTransaction, createTestUser };
  }
});
