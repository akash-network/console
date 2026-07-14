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

    return { stripeTransactionRepository, userRepository, createTestTransaction };
  }
});
