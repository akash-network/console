import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { TxService } from "@src/core/services/tx/tx.service";
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

  describe("findByUserId", () => {
    it("returns the user's transactions newest first", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 1000, createdAt: new Date("2024-01-01T00:00:00Z") });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 3000, createdAt: new Date("2024-03-01T00:00:00Z") });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 2000, createdAt: new Date("2024-02-01T00:00:00Z") });

      const result = await stripeTransactionRepository.findByUserId({ userId: user.id });

      expect(result.map(transaction => transaction.amount)).toEqual([3000, 2000, 1000]);
    });

    it("paginates with limit and offset", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 1000, createdAt: new Date("2024-01-01T00:00:00Z") });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 3000, createdAt: new Date("2024-03-01T00:00:00Z") });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 2000, createdAt: new Date("2024-02-01T00:00:00Z") });

      const firstPage = await stripeTransactionRepository.findByUserId({ userId: user.id, limit: 2, offset: 0 });
      const secondPage = await stripeTransactionRepository.findByUserId({ userId: user.id, limit: 2, offset: 2 });

      expect(firstPage.map(transaction => transaction.amount)).toEqual([3000, 2000]);
      expect(secondPage.map(transaction => transaction.amount)).toEqual([1000]);
    });

    it("returns only the requested user's transactions", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const otherUser = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 1000 });
      await stripeTransactionRepository.create({ ...transactionInput(otherUser.id), amount: 2000 });

      const result = await stripeTransactionRepository.findByUserId({ userId: user.id });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(user.id);
    });
  });

  describe("countByUserId", () => {
    it("counts all of the user's transactions when no date range is given", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id) });
      await stripeTransactionRepository.create({ ...transactionInput(user.id) });

      expect(await stripeTransactionRepository.countByUserId(user.id)).toBe(2);
    });

    it("counts transactions on and within the date-range boundaries, excluding those outside", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const startDate = new Date("2024-06-01T00:00:00Z");
      const endDate = new Date("2024-06-30T23:59:59Z");
      await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: startDate });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: new Date("2024-06-15T12:00:00Z") });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: endDate });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: new Date("2024-05-31T23:59:59Z") });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: new Date("2024-07-01T00:00:00Z") });

      expect(await stripeTransactionRepository.countByUserId(user.id, { startDate, endDate })).toBe(3);
    });
  });

  describe("hasCompletedPaidTransactionBefore", () => {
    const earlier = new Date("2026-01-01T00:00:00Z");
    const current = new Date("2026-02-01T00:00:00Z");
    const later = new Date("2026-03-01T00:00:00Z");

    it.each([
      { status: "succeeded" as const, expected: true },
      { status: "refunded" as const, expected: true },
      { status: "created" as const, expected: false },
      { status: "failed" as const, expected: false },
      { status: "canceled" as const, expected: false }
    ])("answers $expected when an earlier payment_intent is $status", async ({ status, expected }) => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), status, createdAt: earlier });
      const transaction = await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: current });

      await expect(stripeTransactionRepository.hasCompletedPaidTransactionBefore(transaction.id)).resolves.toBe(expected);
    });

    it("answers false for a first purchase, which is not its own predecessor", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const transaction = await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: current });

      await expect(stripeTransactionRepository.hasCompletedPaidTransactionBefore(transaction.id)).resolves.toBe(false);
    });

    it("ignores a purchase made after the given transaction", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const transaction = await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: current });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: later });

      await expect(stripeTransactionRepository.hasCompletedPaidTransactionBefore(transaction.id)).resolves.toBe(false);
    });

    it.each([["manual_credit" as const], ["coupon_claim" as const]])("does not count an earlier %s as a purchase", async type => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), type, createdAt: earlier });
      const transaction = await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: current });

      await expect(stripeTransactionRepository.hasCompletedPaidTransactionBefore(transaction.id)).resolves.toBe(false);
    });

    it("does not count another user's earlier purchase", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const otherUser = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(otherUser.id), createdAt: earlier });
      const transaction = await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: current });

      await expect(stripeTransactionRepository.hasCompletedPaidTransactionBefore(transaction.id)).resolves.toBe(false);
    });

    it("answers false for an unknown transaction", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: earlier });

      await expect(stripeTransactionRepository.hasCompletedPaidTransactionBefore(faker.string.uuid())).resolves.toBe(false);
    });
  });

  describe("createAffiliateCommission", () => {
    it("creates a succeeded usd commission row crediting the affiliate for the source payment", async () => {
      const { stripeTransactionRepository, createTestUser, createTestTransaction } = setup();
      const affiliate = await createTestUser();
      const sourcePayment = await createTestTransaction();

      const commission = await stripeTransactionRepository.createAffiliateCommission({
        userId: affiliate.id,
        amount: 500,
        sourceTransactionId: sourcePayment.id
      });

      expect(commission).toMatchObject({
        userId: affiliate.id,
        type: "affiliate_commission",
        status: "succeeded",
        currency: "usd",
        description: "Affiliate commission",
        amount: 500,
        amountRefunded: 0,
        sourceTransactionId: sourcePayment.id
      });
    });

    it("records the part of the commission already taken back when the source payment was partly refunded", async () => {
      const { stripeTransactionRepository, createTestUser, createTestTransaction } = setup();
      const affiliate = await createTestUser();
      const sourcePayment = await createTestTransaction();

      const commission = await stripeTransactionRepository.createAffiliateCommission({
        userId: affiliate.id,
        amount: 500,
        amountRefunded: 200,
        sourceTransactionId: sourcePayment.id
      });

      expect(commission).toMatchObject({ status: "succeeded", amount: 500, amountRefunded: 200 });
    });

    it("rejects a second commission for the same source transaction", async () => {
      const { stripeTransactionRepository, createTestUser, createTestTransaction } = setup();
      const affiliate = await createTestUser();
      const sourcePayment = await createTestTransaction();
      await stripeTransactionRepository.createAffiliateCommission({ userId: affiliate.id, amount: 500, sourceTransactionId: sourcePayment.id });

      await expect(
        stripeTransactionRepository.createAffiliateCommission({ userId: affiliate.id, amount: 500, sourceTransactionId: sourcePayment.id })
      ).rejects.toThrow();
    });

    it("survives deleting the referred user, with its source transaction id severed to null", async () => {
      const { stripeTransactionRepository, userRepository, createTestUser } = setup();
      const affiliate = await createTestUser();
      const referredUser = await createTestUser();
      const sourcePayment = await stripeTransactionRepository.create({
        userId: referredUser.id,
        type: "payment_intent",
        status: "succeeded",
        amount: 10000,
        currency: "usd"
      });
      const commission = await stripeTransactionRepository.createAffiliateCommission({
        userId: affiliate.id,
        amount: 500,
        sourceTransactionId: sourcePayment.id
      });

      await userRepository.deleteById(referredUser.id);

      await expect(stripeTransactionRepository.findById(commission.id)).resolves.toMatchObject({
        userId: affiliate.id,
        sourceTransactionId: null
      });
    });
  });

  describe("findAffiliateCommissionBySource", () => {
    it("finds the commission row created for the given source transaction", async () => {
      const { stripeTransactionRepository, createTestUser, createTestTransaction } = setup();
      const affiliate = await createTestUser();
      const sourcePayment = await createTestTransaction();
      const created = await stripeTransactionRepository.createAffiliateCommission({
        userId: affiliate.id,
        amount: 500,
        sourceTransactionId: sourcePayment.id
      });

      const found = await stripeTransactionRepository.findAffiliateCommissionBySource(sourcePayment.id);

      expect(found?.id).toBe(created.id);
    });

    it("returns undefined when no commission was created for the source transaction", async () => {
      const { stripeTransactionRepository, createTestTransaction } = setup();
      const sourcePayment = await createTestTransaction();

      const found = await stripeTransactionRepository.findAffiliateCommissionBySource(sourcePayment.id);

      expect(found).toBeUndefined();
    });
  });

  describe("findAffiliateCommissionBySourceAndLock", () => {
    it("finds the commission row inside a transaction", async () => {
      const { stripeTransactionRepository, createTestUser, createTestTransaction } = setup();
      const affiliate = await createTestUser();
      const sourcePayment = await createTestTransaction();
      const created = await stripeTransactionRepository.createAffiliateCommission({
        userId: affiliate.id,
        amount: 500,
        sourceTransactionId: sourcePayment.id
      });
      const txService = container.resolve(TxService);

      const found = await txService.transaction(async () => stripeTransactionRepository.findAffiliateCommissionBySourceAndLock(sourcePayment.id));

      expect(found?.id).toBe(created.id);
    });

    it("returns undefined outside of a transaction", async () => {
      const { stripeTransactionRepository, createTestUser, createTestTransaction } = setup();
      const affiliate = await createTestUser();
      const sourcePayment = await createTestTransaction();
      await stripeTransactionRepository.createAffiliateCommission({ userId: affiliate.id, amount: 500, sourceTransactionId: sourcePayment.id });

      const found = await stripeTransactionRepository.findAffiliateCommissionBySourceAndLock(sourcePayment.id);

      expect(found).toBeUndefined();
    });
  });

  describe("sumAffiliateCommissionNet", () => {
    it("sums the net (amount minus amountRefunded) of the user's commission rows", async () => {
      const { stripeTransactionRepository, createTestUser, createTestCommission } = setup();
      const affiliate = await createTestUser();
      await createTestCommission(affiliate.id, { amount: 500, amountRefunded: 100 });
      await createTestCommission(affiliate.id, { amount: 300, amountRefunded: 0 });

      await expect(stripeTransactionRepository.sumAffiliateCommissionNet(affiliate.id)).resolves.toBe(700);
    });

    it("returns 0 when the user has no commission rows", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const affiliate = await createTestUser();

      await expect(stripeTransactionRepository.sumAffiliateCommissionNet(affiliate.id)).resolves.toBe(0);
    });

    it("excludes another user's commissions", async () => {
      const { stripeTransactionRepository, createTestUser, createTestCommission } = setup();
      const affiliate = await createTestUser();
      const otherAffiliate = await createTestUser();
      await createTestCommission(otherAffiliate.id, { amount: 500 });

      await expect(stripeTransactionRepository.sumAffiliateCommissionNet(affiliate.id)).resolves.toBe(0);
    });

    it("excludes a non-commission transaction of the same user", async () => {
      const { stripeTransactionRepository, createTestUser, createTestTransaction } = setup();
      const affiliate = await createTestUser();
      await createTestTransaction({ userId: affiliate.id, amount: 10000 });

      await expect(stripeTransactionRepository.sumAffiliateCommissionNet(affiliate.id)).resolves.toBe(0);
    });

    it("counts only commissions on or after the given boundary", async () => {
      const { stripeTransactionRepository, createTestUser, createTestCommission } = setup();
      const affiliate = await createTestUser();
      const monthStart = new Date("2024-06-01T00:00:00Z");
      await createTestCommission(affiliate.id, { amount: 500, createdAt: new Date("2024-05-31T23:59:59Z") });
      await createTestCommission(affiliate.id, { amount: 300, createdAt: monthStart });
      await createTestCommission(affiliate.id, { amount: 200, createdAt: new Date("2024-06-15T00:00:00Z") });

      await expect(stripeTransactionRepository.sumAffiliateCommissionNet(affiliate.id, monthStart)).resolves.toBe(500);
    });
  });

  describe("findAffiliateCommissions", () => {
    it("returns the user's commissions newest first", async () => {
      const { stripeTransactionRepository, createTestUser, createTestCommission } = setup();
      const affiliate = await createTestUser();
      const older = await createTestCommission(affiliate.id, { createdAt: new Date("2024-01-01T00:00:00Z") });
      const newer = await createTestCommission(affiliate.id, { createdAt: new Date("2024-02-01T00:00:00Z") });

      const result = await stripeTransactionRepository.findAffiliateCommissions(affiliate.id);

      expect(result.map(commission => commission.id)).toEqual([newer.id, older.id]);
    });

    it("limits the number of rows returned", async () => {
      const { stripeTransactionRepository, createTestUser, createTestCommission } = setup();
      const affiliate = await createTestUser();
      await createTestCommission(affiliate.id, { createdAt: new Date("2024-01-01T00:00:00Z") });
      const newest = await createTestCommission(affiliate.id, { createdAt: new Date("2024-02-01T00:00:00Z") });

      const result = await stripeTransactionRepository.findAffiliateCommissions(affiliate.id, 1);

      expect(result.map(commission => commission.id)).toEqual([newest.id]);
    });

    it("excludes another user's commissions and the user's non-commission transactions", async () => {
      const { stripeTransactionRepository, createTestUser, createTestCommission, createTestTransaction } = setup();
      const affiliate = await createTestUser();
      const otherAffiliate = await createTestUser();
      await createTestCommission(otherAffiliate.id);
      await createTestTransaction({ userId: affiliate.id });

      await expect(stripeTransactionRepository.findAffiliateCommissions(affiliate.id)).resolves.toEqual([]);
    });
  });

  let cleanup: () => Promise<void>;
  afterEach(async () => {
    await cleanup?.();
  });

  function transactionInput(userId: string): StripeTransactionInput {
    return {
      userId,
      type: "payment_intent",
      status: "succeeded",
      amount: faker.number.int({ min: 1000, max: 100000 }),
      currency: "usd"
    };
  }

  describe("hasPaidUserWithEmailDomain", () => {
    it.each([
      { status: "succeeded" as const, expected: true },
      { status: "refunded" as const, expected: true },
      { status: "created" as const, expected: false },
      { status: "failed" as const, expected: false }
    ])("answers $expected for a payment_intent in $status", async ({ status, expected }) => {
      const { stripeTransactionRepository, createUserOnDomain } = setup();
      const domain = uniqueDomain();
      const user = await createUserOnDomain(domain);
      await stripeTransactionRepository.create({ userId: user.id, type: "payment_intent", status, amount: 1000, currency: "usd" });

      await expect(stripeTransactionRepository.hasPaidUserWithEmailDomain(domain)).resolves.toBe(expected);
    });

    it.each([["manual_credit" as const], ["coupon_claim" as const]])("does not count a %s, so a granted credit cannot shield a domain", async type => {
      const { stripeTransactionRepository, createUserOnDomain } = setup();
      const domain = uniqueDomain();
      const user = await createUserOnDomain(domain);
      await stripeTransactionRepository.create({ userId: user.id, type, status: "succeeded", amount: 1000, currency: "usd" });

      await expect(stripeTransactionRepository.hasPaidUserWithEmailDomain(domain)).resolves.toBe(false);
    });

    it("matches the domain part only, never a domain that merely contains it", async () => {
      const { stripeTransactionRepository, createUserOnDomain } = setup();
      const domain = uniqueDomain();
      const lookalikes = [`x${domain}`, `${domain}.attacker.net`, `mail.${domain}`];
      for (const lookalike of lookalikes) {
        const user = await createUserOnDomain(lookalike);
        await stripeTransactionRepository.create({ userId: user.id, type: "payment_intent", status: "succeeded", amount: 1000, currency: "usd" });
      }

      await expect(stripeTransactionRepository.hasPaidUserWithEmailDomain(domain)).resolves.toBe(false);
    });

    it("matches a stored address whatever its case", async () => {
      const { stripeTransactionRepository, createUserOnDomain } = setup();
      const domain = uniqueDomain();
      const user = await createUserOnDomain(domain.toUpperCase());
      await stripeTransactionRepository.create({ userId: user.id, type: "payment_intent", status: "succeeded", amount: 1000, currency: "usd" });

      await expect(stripeTransactionRepository.hasPaidUserWithEmailDomain(domain)).resolves.toBe(true);
    });

    it("answers false for a domain nobody has paid from", async () => {
      const { stripeTransactionRepository, createUserOnDomain } = setup();
      const domain = uniqueDomain();
      await createUserOnDomain(domain);

      await expect(stripeTransactionRepository.hasPaidUserWithEmailDomain(domain)).resolves.toBe(false);
    });
  });

  function uniqueDomain() {
    return `${faker.string.alphanumeric(16).toLowerCase()}.com`;
  }

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

    async function createUserOnDomain(domain: string) {
      const user = await userRepository.create({ userId: faker.string.uuid(), email: `${faker.string.alphanumeric(10)}@${domain}` });
      createdUserIds.push(user.id);
      return user;
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

    async function createTestCommission(userId: string, overrides: Partial<StripeTransactionInput> = {}) {
      return stripeTransactionRepository.create({
        userId,
        type: "affiliate_commission",
        status: "succeeded",
        amount: faker.number.int({ min: 100, max: 1000 }),
        amountRefunded: 0,
        currency: "usd",
        ...overrides
      });
    }

    return { stripeTransactionRepository, userRepository, createTestTransaction, createTestCommission, createTestUser, createUserOnDomain };
  }
});
