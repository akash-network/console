import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { PaymentCreditRepository } from "@src/billing/repositories/payment-credit/payment-credit.repository";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { type StripeTransactionInput, StripeTransactionRepository } from "./stripe-transaction.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

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

  describe("findByOwner", () => {
    it("returns the user's transactions newest first", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 1000, createdAt: new Date("2024-01-01T00:00:00Z") });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 3000, createdAt: new Date("2024-03-01T00:00:00Z") });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 2000, createdAt: new Date("2024-02-01T00:00:00Z") });

      const result = await stripeTransactionRepository.findByOwner({ owner: { userId: user.id } });

      expect(result.map(transaction => transaction.amount)).toEqual([3000, 2000, 1000]);
    });

    it("paginates with limit and offset", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 1000, createdAt: new Date("2024-01-01T00:00:00Z") });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 3000, createdAt: new Date("2024-03-01T00:00:00Z") });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 2000, createdAt: new Date("2024-02-01T00:00:00Z") });

      const firstPage = await stripeTransactionRepository.findByOwner({ owner: { userId: user.id }, limit: 2, offset: 0 });
      const secondPage = await stripeTransactionRepository.findByOwner({ owner: { userId: user.id }, limit: 2, offset: 2 });

      expect(firstPage.map(transaction => transaction.amount)).toEqual([3000, 2000]);
      expect(secondPage.map(transaction => transaction.amount)).toEqual([1000]);
    });

    it("returns only the requested user's transactions", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const otherUser = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 1000 });
      await stripeTransactionRepository.create({ ...transactionInput(otherUser.id), amount: 2000 });

      const result = await stripeTransactionRepository.findByOwner({ owner: { userId: user.id } });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(user.id);
    });

    it("reads a team's transactions with the member who made each, leaving them out of that member's own", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const { organization: team } = await seedOrganizationWithOwner();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 1000 });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), organizationId: team.id, amount: 2000 });

      const teamTransactions = await stripeTransactionRepository.findByOwner({ owner: { organizationId: team.id } });
      const ownTransactions = await stripeTransactionRepository.findByOwner({ owner: { userId: user.id } });

      expect(teamTransactions).toEqual([expect.objectContaining({ amount: 2000, initiatedBy: { id: user.id, username: user.username, email: user.email } })]);
      expect(ownTransactions.map(transaction => transaction.amount)).toEqual([1000]);
      expect(await stripeTransactionRepository.countByOwner({ organizationId: team.id })).toBe(1);
    });
  });

  describe("countByOwner", () => {
    it("counts all of the user's transactions when no date range is given", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id) });
      await stripeTransactionRepository.create({ ...transactionInput(user.id) });

      expect(await stripeTransactionRepository.countByOwner({ userId: user.id })).toBe(2);
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

      expect(await stripeTransactionRepository.countByOwner({ userId: user.id }, { startDate, endDate })).toBe(3);
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

  describe("findCouponClaimsOutside", () => {
    it("finds a claim the person made for themselves when they redeem the same coupon for a team", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const { organization: team } = await seedOrganizationWithOwner();
      const user = await createTestUser();
      const claim = await stripeTransactionRepository.create({
        userId: user.id,
        type: "coupon_claim",
        status: "succeeded",
        amount: 1000,
        stripeCouponId: "coupon_1"
      });

      expect(await stripeTransactionRepository.findCouponClaimsOutside({ userId: user.id, couponId: "coupon_1", owner: { organizationId: team.id } })).toEqual([
        { id: claim.id, status: "succeeded", stripeInvoiceId: null, isStale: false }
      ]);
      expect(await stripeTransactionRepository.findCouponClaimsOutside({ userId: user.id, couponId: "coupon_1", owner: { userId: user.id } })).toEqual([]);
    });

    it("finds a claim the person made for a team when they redeem the same coupon for themselves or another team", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const [{ organization: team }, { organization: otherTeam }] = await Promise.all([seedOrganizationWithOwner(), seedOrganizationWithOwner()]);
      const user = await createTestUser();
      await stripeTransactionRepository.create({
        userId: user.id,
        organizationId: team.id,
        type: "coupon_claim",
        status: "pending",
        amount: 1000,
        stripeCouponId: "coupon_1"
      });

      expect(await stripeTransactionRepository.findCouponClaimsOutside({ userId: user.id, couponId: "coupon_1", owner: { userId: user.id } })).toHaveLength(1);
      expect(
        await stripeTransactionRepository.findCouponClaimsOutside({ userId: user.id, couponId: "coupon_1", owner: { organizationId: otherTeam.id } })
      ).toHaveLength(1);
      expect(await stripeTransactionRepository.findCouponClaimsOutside({ userId: user.id, couponId: "coupon_1", owner: { organizationId: team.id } })).toEqual(
        []
      );
    });

    it("drops a claim left pending for more than an hour without an invoice", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const { organization: team } = await seedOrganizationWithOwner();
      const user = await createTestUser();
      await insertStaleClaim({ userId: user.id, stripeInvoiceId: null });

      expect(await stripeTransactionRepository.findCouponClaimsOutside({ userId: user.id, couponId: "coupon_1", owner: { organizationId: team.id } })).toEqual(
        []
      );
    });

    it("keeps a claim left pending for more than an hour with an invoice, marked stale", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const { organization: team } = await seedOrganizationWithOwner();
      const user = await createTestUser();
      const invoiceId = `in_${faker.string.alphanumeric(14)}`;
      await insertStaleClaim({ userId: user.id, stripeInvoiceId: invoiceId });

      expect(await stripeTransactionRepository.findCouponClaimsOutside({ userId: user.id, couponId: "coupon_1", owner: { organizationId: team.id } })).toEqual([
        expect.objectContaining({ status: "pending", stripeInvoiceId: invoiceId, isStale: true })
      ]);
    });

    it("ignores another coupon, another person and a claim that never went through", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const { organization: team } = await seedOrganizationWithOwner();
      const [user, otherUser] = await Promise.all([createTestUser(), createTestUser()]);
      await stripeTransactionRepository.create({ userId: user.id, type: "coupon_claim", status: "succeeded", amount: 1000, stripeCouponId: "coupon_2" });
      await stripeTransactionRepository.create({ userId: otherUser.id, type: "coupon_claim", status: "succeeded", amount: 1000, stripeCouponId: "coupon_1" });
      await stripeTransactionRepository.create({ userId: user.id, type: "coupon_claim", status: "failed", amount: 1000, stripeCouponId: "coupon_1" });

      expect(await stripeTransactionRepository.findCouponClaimsOutside({ userId: user.id, couponId: "coupon_1", owner: { organizationId: team.id } })).toEqual(
        []
      );
    });

    async function insertStaleClaim(input: { userId: string; stripeInvoiceId: string | null }) {
      await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .insert(resolveTable("StripeTransactions"))
        .values({ ...input, type: "coupon_claim", status: "pending", amount: 1000, stripeCouponId: "coupon_1", createdAt: sql`now() - interval '2 hours'` });
    }
  });

  describe("findEarliestCompletedPaidTransaction", () => {
    it.each([
      { status: "succeeded" as const, isCompleted: true },
      { status: "refunded" as const, isCompleted: true },
      { status: "created" as const, isCompleted: false },
      { status: "failed" as const, isCompleted: false }
    ])("finds a team's payment_intent in $status only when $isCompleted", async ({ status, isCompleted }) => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const { organization: team } = await seedOrganizationWithOwner();
      const user = await createTestUser();
      const purchase = await stripeTransactionRepository.create({ ...transactionInput(user.id), organizationId: team.id, status });

      const earliest = await stripeTransactionRepository.findEarliestCompletedPaidTransaction({ organizationId: team.id });

      expect(earliest?.id).toBe(isCompleted ? purchase.id : undefined);
    });

    it("finds the earliest of the owner's purchases with its time and amount, even when it was refunded", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: new Date("2026-01-03T00:00:00Z") });
      const first = await stripeTransactionRepository.create({
        ...transactionInput(user.id),
        status: "refunded",
        amount: 2000,
        amountRefunded: 2000,
        createdAt: new Date("2026-01-01T00:00:00Z")
      });
      await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: new Date("2026-01-02T00:00:00Z") });

      await expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction({ userId: user.id })).resolves.toEqual({
        id: first.id,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        amount: 2000
      });
    });

    it("leaves out the transaction it is told to exclude", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const excluded = await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: new Date("2026-01-01T00:00:00Z") });
      const next = await stripeTransactionRepository.create({ ...transactionInput(user.id), createdAt: new Date("2026-01-02T00:00:00Z") });

      const earliest = await stripeTransactionRepository.findEarliestCompletedPaidTransaction({ userId: user.id }, { excludeId: excluded.id });

      expect(earliest?.id).toBe(next.id);
    });

    it("finds nothing when the only purchase is the excluded one", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const excluded = await stripeTransactionRepository.create(transactionInput(user.id));

      await expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction({ userId: user.id }, { excludeId: excluded.id })).resolves.toBeUndefined();
    });

    it("never counts a coupon claim", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), type: "coupon_claim" });

      await expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction({ userId: user.id })).resolves.toBeUndefined();
    });

    it("keeps a member's purchase for a team apart from the member's own account and from other teams", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const [{ organization: team }, { organization: otherTeam }] = await Promise.all([seedOrganizationWithOwner(), seedOrganizationWithOwner()]);
      const user = await createTestUser();
      const purchase = await stripeTransactionRepository.create({ ...transactionInput(user.id), organizationId: team.id });

      await expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction({ organizationId: team.id })).resolves.toMatchObject({ id: purchase.id });
      await expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction({ organizationId: otherTeam.id })).resolves.toBeUndefined();
      await expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction({ userId: user.id })).resolves.toBeUndefined();
    });

    it("finds the user's own purchases, whether or not they are filed under an organization", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const [filedUser, unfiledUser] = await Promise.all([createTestUser(), createTestUser()]);
      const { organization: personal } = await seedOrganizationWithOwner({ type: "personal" });
      const filed = await stripeTransactionRepository.create({ ...transactionInput(filedUser.id), organizationId: personal.id });
      const unfiled = await stripeTransactionRepository.create(transactionInput(unfiledUser.id));

      await expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction({ userId: filedUser.id })).resolves.toMatchObject({ id: filed.id });
      await expect(stripeTransactionRepository.findEarliestCompletedPaidTransaction({ userId: unfiledUser.id })).resolves.toMatchObject({ id: unfiled.id });
    });

    it("finds a purchase not yet filed into any organization while the person's organization is active", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const { organization: personal } = await seedOrganizationWithOwner({ type: "personal" });
      const purchase = await stripeTransactionRepository.create(transactionInput(user.id));

      const earliest = await inOrganization({ user, organizationId: personal.id }, () =>
        stripeTransactionRepository.findEarliestCompletedPaidTransaction({ userId: user.id })
      );

      expect(earliest?.id).toBe(purchase.id);
    });
  });

  describe("hasCompletedPaidTransactionOfAtLeast", () => {
    it.each([
      { amount: 10000, expected: true },
      { amount: 10001, expected: true },
      { amount: 9999, expected: false }
    ])("answers $expected for a purchase of $amount cents against a 10000 cents minimum", async ({ amount, expected }) => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount });

      await expect(stripeTransactionRepository.hasCompletedPaidTransactionOfAtLeast({ userId: user.id }, 10000)).resolves.toBe(expected);
    });

    it.each([
      { status: "succeeded" as const, expected: true },
      { status: "refunded" as const, expected: true },
      { status: "created" as const, expected: false },
      { status: "failed" as const, expected: false }
    ])("answers $expected for a large payment_intent in $status", async ({ status, expected }) => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), amount: 10000, status });

      await expect(stripeTransactionRepository.hasCompletedPaidTransactionOfAtLeast({ userId: user.id }, 10000)).resolves.toBe(expected);
    });

    it("never counts a coupon claim", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), type: "coupon_claim", amount: 10000 });

      await expect(stripeTransactionRepository.hasCompletedPaidTransactionOfAtLeast({ userId: user.id }, 10000)).resolves.toBe(false);
    });

    it("keeps a member's large purchase for a team apart from the member's own account", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const { organization: team } = await seedOrganizationWithOwner();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), organizationId: team.id, amount: 10000 });

      await expect(stripeTransactionRepository.hasCompletedPaidTransactionOfAtLeast({ organizationId: team.id }, 10000)).resolves.toBe(true);
      await expect(stripeTransactionRepository.hasCompletedPaidTransactionOfAtLeast({ userId: user.id }, 10000)).resolves.toBe(false);
    });
  });

  describe("hasReceivedFirstPurchaseBonus", () => {
    it.each(["succeeded" as const, "refunded" as const])("counts a bonus the person received on a purchase now %s", async status => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), status, bonusAmount: 1000 });

      await expect(stripeTransactionRepository.hasReceivedFirstPurchaseBonus(user.id)).resolves.toBe(true);
    });

    it("ignores purchases that carried no bonus and bonuses of other people", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const [user, otherUser] = await Promise.all([createTestUser(), createTestUser()]);
      await stripeTransactionRepository.create({ ...transactionInput(user.id), bonusAmount: 0 });
      await stripeTransactionRepository.create({ ...transactionInput(otherUser.id), bonusAmount: 1000 });

      await expect(stripeTransactionRepository.hasReceivedFirstPurchaseBonus(user.id)).resolves.toBe(false);
    });

    it("sees a bonus the person received for a team while another organization is active", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const [{ organization: team }, { organization: otherTeam }] = await Promise.all([seedOrganizationWithOwner(), seedOrganizationWithOwner()]);
      const user = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(user.id), organizationId: team.id, bonusAmount: 1000 });

      const hasBonus = await inOrganization({ user, organizationId: otherTeam.id }, () => stripeTransactionRepository.hasReceivedFirstPurchaseBonus(user.id));

      expect(hasBonus).toBe(true);
    });

    it("counts a bonus credited on chain for a purchase whose settlement has not committed", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const purchase = await stripeTransactionRepository.create({ ...transactionInput(user.id), status: "pending", amount: 10000 });
      await container
        .resolve(PaymentCreditRepository)
        .createPending({ transactionId: purchase.id, address: createAkashAddress(), amount: 11000, bonusAmount: 1000 });

      await expect(stripeTransactionRepository.hasReceivedFirstPurchaseBonus(user.id)).resolves.toBe(true);
    });

    it("leaves out the bonus credited for the purchase being settled and credits that carried none", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const user = await createTestUser();
      const [settling, unrewarded] = await Promise.all([
        stripeTransactionRepository.create({ ...transactionInput(user.id), status: "pending" }),
        stripeTransactionRepository.create({ ...transactionInput(user.id), status: "pending" })
      ]);
      const paymentCreditRepository = container.resolve(PaymentCreditRepository);
      await paymentCreditRepository.createPending({ transactionId: settling.id, address: createAkashAddress(), amount: 11000, bonusAmount: 1000 });
      await paymentCreditRepository.createPending({ transactionId: unrewarded.id, address: createAkashAddress(), amount: 5000, bonusAmount: 0 });

      await expect(stripeTransactionRepository.hasReceivedFirstPurchaseBonus(user.id, { excludeTransactionId: settling.id })).resolves.toBe(false);
    });
  });

  describe("recordFirstPurchaseBonus", () => {
    it("records the bonus of a person who holds none, whoever else holds one", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const [person, otherPerson] = await Promise.all([createTestUser(), createTestUser()]);
      await stripeTransactionRepository.create({ ...transactionInput(otherPerson.id), bonusAmount: 1000 });
      const purchase = await stripeTransactionRepository.create({ ...transactionInput(person.id) });

      const isRecorded = await stripeTransactionRepository.recordFirstPurchaseBonus(purchase.id, 1000);

      expect(isRecorded).toBe(true);
      expect(await stripeTransactionRepository.findById(purchase.id)).toMatchObject({ bonusAmount: 1000 });
    });

    it("refuses a second bonus to a person whose refunded one was for another team, leaving the settling transaction usable", async () => {
      const { stripeTransactionRepository, txService, createTestUser } = setup();
      const [{ organization: team }, { organization: otherTeam }] = await Promise.all([seedOrganizationWithOwner(), seedOrganizationWithOwner()]);
      const person = await createTestUser();
      await stripeTransactionRepository.create({ ...transactionInput(person.id), organizationId: team.id, status: "refunded", bonusAmount: 1000 });
      const purchase = await stripeTransactionRepository.create({ ...transactionInput(person.id), organizationId: otherTeam.id, status: "pending" });

      const isRecorded = await txService.transaction(async () => {
        const recorded = await stripeTransactionRepository.recordFirstPurchaseBonus(purchase.id, 1000);
        await stripeTransactionRepository.updateById(purchase.id, { status: "succeeded" });
        return recorded;
      });

      expect(isRecorded).toBe(false);
      expect(await stripeTransactionRepository.findById(purchase.id)).toMatchObject({ status: "succeeded", bonusAmount: 0 });
    });

    it("lets the bonuses of members who deleted their account sit side by side", async () => {
      const { stripeTransactionRepository } = setup();
      const { organization: team, user: member } = await seedOrganizationWithOwner();
      const detachedRecord = { ...transactionInput(member.id), userId: null, organizationId: team.id };
      await stripeTransactionRepository.create({ ...detachedRecord, bonusAmount: 1000 });
      const purchase = await stripeTransactionRepository.create(detachedRecord);

      await expect(stripeTransactionRepository.recordFirstPurchaseBonus(purchase.id, 1000)).resolves.toBe(true);
    });

    it("rethrows a failure other than the person already holding a bonus", async () => {
      const { stripeTransactionRepository, createTestUser } = setup();
      const purchase = await stripeTransactionRepository.create({ ...transactionInput((await createTestUser()).id) });

      await expect(stripeTransactionRepository.recordFirstPurchaseBonus(purchase.id, 2 ** 31)).rejects.toThrow();
    });
  });

  async function inOrganization<R>(context: Partial<OrganizationContext> & { user: UserOutput }, run: () => Promise<R>): Promise<R> {
    const executionContextService = container.resolve(ExecutionContextService);
    const { user, ...organizationContext } = context;

    return await executionContextService.runWithContext(async () => {
      executionContextService.set("CURRENT_USER", user);
      executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext(organizationContext));
      return await run();
    });
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
    const txService = container.resolve(TxService);
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

    return { stripeTransactionRepository, userRepository, txService, createTestTransaction, createTestUser, createUserOnDomain };
  }
});
