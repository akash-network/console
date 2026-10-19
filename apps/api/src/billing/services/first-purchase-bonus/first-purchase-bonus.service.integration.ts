import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import { FirstPurchaseBonusWinBackRepository } from "@src/billing/repositories/first-purchase-bonus-win-back/first-purchase-bonus-win-back.repository";
import { TxService } from "@src/core/services/tx/tx.service";
import { FirstPurchaseBonusService } from "./first-purchase-bonus.service";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const QUALIFYING_AMOUNT_CENTS = 100_00;
const SMALL_AMOUNT_CENTS = 20_00;
const FIRST_PAYMENT_AT = new Date("2026-01-01T00:00:00.000Z");

describe(FirstPurchaseBonusService.name, () => {
  describe("getEligibleBonusAmount", () => {
    it("grants one bonus when one person's first purchases for two organizations settle at the same time", async () => {
      const { settleConcurrently, pendingPurchase } = setup();
      const person = await seedUser();
      const [{ organization: team }, { organization: otherTeam }] = await Promise.all([seedOrganizationWithOwner(), seedOrganizationWithOwner()]);
      const purchases = await Promise.all([pendingPurchase(person.id, team.id), pendingPurchase(person.id, otherTeam.id)]);

      const bonusAmounts = await settleConcurrently(purchases);

      expect(bonusAmounts.sort((a, b) => a - b)).toEqual([0, QUALIFYING_AMOUNT_CENTS / 10]);
    });

    it("grants one bonus when two members' first purchases for the same team settle at the same time", async () => {
      const { settleConcurrently, pendingPurchase } = setup();
      const { organization: team, user: owner } = await seedOrganizationWithOwner();
      const member = await seedUser();
      await seedOrganizationMember({ organizationId: team.id, userId: member.id, role: "billing" });
      const purchases = await Promise.all([pendingPurchase(owner.id, team.id), pendingPurchase(member.id, team.id)]);

      const bonusAmounts = await settleConcurrently(purchases);

      expect(bonusAmounts.sort((a, b) => a - b)).toEqual([0, QUALIFYING_AMOUNT_CENTS / 10]);
    });

    it("grants the bonus on a first purchase for a new team by a person whose own account paid without one", async () => {
      const { stripeTransactionRepository, pendingPurchase, eligibleBonus } = setup();
      const person = await seedUser();
      const { organization: team } = await seedOrganizationWithOwner();
      await stripeTransactionRepository.create({ userId: person.id, type: "payment_intent", status: "succeeded", amount: SMALL_AMOUNT_CENTS, currency: "usd" });
      const purchase = await pendingPurchase(person.id, team.id);

      await expect(eligibleBonus(purchase)).resolves.toEqual({ bonusCents: QUALIFYING_AMOUNT_CENTS / 10, window: null });
    });

    it("refuses the bonus to a person whose bonused purchase was refunded", async () => {
      const { stripeTransactionRepository, pendingPurchase, eligibleBonus } = setup();
      const person = await seedUser();
      const [{ organization: team }, { organization: otherTeam }] = await Promise.all([seedOrganizationWithOwner(), seedOrganizationWithOwner()]);
      await stripeTransactionRepository.create({
        userId: person.id,
        organizationId: team.id,
        type: "payment_intent",
        status: "refunded",
        amount: QUALIFYING_AMOUNT_CENTS,
        amountRefunded: QUALIFYING_AMOUNT_CENTS,
        bonusAmount: QUALIFYING_AMOUNT_CENTS / 10,
        currency: "usd"
      });
      const purchase = await pendingPurchase(person.id, otherTeam.id);

      await expect(eligibleBonus(purchase)).resolves.toEqual({ bonusCents: 0, window: null });
    });

    describe("when the paying account made a small first purchase", () => {
      it("grants the bonus to a personal purchase made 6 days and 23 hours after a refunded small first purchase, settled days later", async () => {
        const { stripeTransactionRepository, pendingPurchase, eligibleBonus } = setup();
        const person = await seedUser();
        await stripeTransactionRepository.create({
          userId: person.id,
          type: "payment_intent",
          status: "refunded",
          amount: SMALL_AMOUNT_CENTS,
          amountRefunded: SMALL_AMOUNT_CENTS,
          currency: "usd",
          createdAt: FIRST_PAYMENT_AT
        });
        const purchase = await pendingPurchase(person.id, null, new Date("2026-01-07T23:00:00.000Z"));

        await expect(eligibleBonus(purchase)).resolves.toEqual({ bonusCents: QUALIFYING_AMOUNT_CENTS / 10, window: "small_first_purchase" });
      });

      it("grants nothing to a personal purchase made 7 days after the small first purchase", async () => {
        const { smallFirstPurchase, pendingPurchase, eligibleBonus } = setup();
        const person = await seedUser();
        await smallFirstPurchase(person.id, null);
        const purchase = await pendingPurchase(person.id, null, new Date("2026-01-08T00:00:00.000Z"));

        await expect(eligibleBonus(purchase)).resolves.toEqual({ bonusCents: 0, window: null });
      });

      it("grants nothing on the personal account of a person who already received the bonus on a team", async () => {
        const { stripeTransactionRepository, smallFirstPurchase, pendingPurchase, eligibleBonus } = setup();
        const person = await seedUser();
        const { organization: team } = await seedOrganizationWithOwner();
        await stripeTransactionRepository.create({
          userId: person.id,
          organizationId: team.id,
          type: "payment_intent",
          status: "succeeded",
          amount: QUALIFYING_AMOUNT_CENTS,
          bonusAmount: QUALIFYING_AMOUNT_CENTS / 10,
          currency: "usd"
        });
        await smallFirstPurchase(person.id, null);
        const purchase = await pendingPurchase(person.id, null, new Date("2026-01-02T00:00:00.000Z"));

        await expect(eligibleBonus(purchase)).resolves.toEqual({ bonusCents: 0, window: null });
      });

      it("grants nothing to a team's purchase made a day after the team's small first purchase", async () => {
        const { smallFirstPurchase, pendingPurchase, eligibleBonus } = setup();
        const { organization: team, user: owner } = await seedOrganizationWithOwner();
        await smallFirstPurchase(owner.id, team.id);
        const purchase = await pendingPurchase(owner.id, team.id, new Date("2026-01-02T00:00:00.000Z"));

        await expect(eligibleBonus(purchase)).resolves.toEqual({ bonusCents: 0, window: null });
      });
    });

    describe("when the person has a gpu win-back", () => {
      it("grants the bonus to a personal purchase made before the win-back closes, long after a small first purchase", async () => {
        const { smallFirstPurchase, pendingPurchase, eligibleBonus, openWinBack } = setup();
        const person = await seedUser();
        await smallFirstPurchase(person.id, null);
        await openWinBack(person.id, new Date("2026-03-08T00:00:00.000Z"));
        const purchase = await pendingPurchase(person.id, null, new Date("2026-03-07T23:00:00.000Z"));

        await expect(eligibleBonus(purchase)).resolves.toEqual({ bonusCents: QUALIFYING_AMOUNT_CENTS / 10, window: "gpu_win_back" });
      });

      it("grants nothing to a personal purchase made once the win-back closed", async () => {
        const { smallFirstPurchase, pendingPurchase, eligibleBonus, openWinBack } = setup();
        const person = await seedUser();
        await smallFirstPurchase(person.id, null);
        await openWinBack(person.id, new Date("2026-03-08T00:00:00.000Z"));
        const purchase = await pendingPurchase(person.id, null, new Date("2026-03-08T00:00:00.000Z"));

        await expect(eligibleBonus(purchase)).resolves.toEqual({ bonusCents: 0, window: null });
      });

      it("grants nothing on a win-back without a deadline once the account has paid", async () => {
        const { smallFirstPurchase, pendingPurchase, eligibleBonus, openWinBack } = setup();
        const person = await seedUser();
        await openWinBack(person.id, null);
        await smallFirstPurchase(person.id, null);
        const purchase = await pendingPurchase(person.id, null, new Date("2026-03-07T23:00:00.000Z"));

        await expect(eligibleBonus(purchase)).resolves.toEqual({ bonusCents: 0, window: null });
      });
    });
  });

  describe("findWindowOpenedBy", () => {
    it("opens one window when one person's two small first purchases settle at the same time", async () => {
      const { pendingSmallPurchase, openWindowsConcurrently } = setup();
      const person = await seedUser();
      const purchases = await Promise.all([pendingSmallPurchase(person.id), pendingSmallPurchase(person.id)]);

      const openedWindows = await openWindowsConcurrently(purchases);

      expect(openedWindows.filter(Boolean)).toEqual([expect.objectContaining({ userId: person.id, reason: "small_first_purchase" })]);
    });
  });

  function setup() {
    const service = container.resolve(FirstPurchaseBonusService);
    const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
    const txService = container.resolve(TxService);

    const pendingPurchase = (userId: string, organizationId: string | null, createdAt?: Date) =>
      stripeTransactionRepository.create({
        userId,
        organizationId,
        type: "payment_intent",
        status: "pending",
        amount: QUALIFYING_AMOUNT_CENTS,
        currency: "usd",
        createdAt
      });

    const smallFirstPurchase = (userId: string, organizationId: string | null) =>
      stripeTransactionRepository.create({
        userId,
        organizationId,
        type: "payment_intent",
        status: "succeeded",
        amount: SMALL_AMOUNT_CENTS,
        currency: "usd",
        createdAt: FIRST_PAYMENT_AT
      });

    const settleConcurrently = async (purchases: StripeTransactionOutput[]) => {
      await Promise.all(
        purchases.map(purchase =>
          txService.transaction(async () => {
            const { bonusCents } = await service.getEligibleBonusAmount(purchase, QUALIFYING_AMOUNT_CENTS);
            await delay(100);
            await stripeTransactionRepository.updateById(purchase.id, { status: "succeeded", bonusAmount: bonusCents });
          })
        )
      );

      const settled = await Promise.all(purchases.map(purchase => stripeTransactionRepository.findById(purchase.id)));

      return settled.map(purchase => purchase!.bonusAmount);
    };

    const eligibleBonus = (purchase: StripeTransactionOutput) => txService.transaction(() => service.getEligibleBonusAmount(purchase, QUALIFYING_AMOUNT_CENTS));

    const pendingSmallPurchase = (userId: string) =>
      stripeTransactionRepository.create({ userId, type: "payment_intent", status: "pending", amount: SMALL_AMOUNT_CENTS, currency: "usd" });

    const openWindowsConcurrently = (purchases: StripeTransactionOutput[]) =>
      Promise.all(
        purchases.map(purchase =>
          txService.transaction(async () => {
            await stripeTransactionRepository.updateById(purchase.id, { status: "succeeded" });
            const openedWindow = await service.findWindowOpenedBy(purchase);
            await delay(100);
            return openedWindow;
          })
        )
      );

    const openWinBack = (userId: string, closesAt: Date | null) =>
      container.resolve(FirstPurchaseBonusWinBackRepository).create({ userId, openedAt: new Date("2026-03-01T00:00:00.000Z"), closesAt });

    return {
      stripeTransactionRepository,
      pendingPurchase,
      pendingSmallPurchase,
      smallFirstPurchase,
      settleConcurrently,
      eligibleBonus,
      openWindowsConcurrently,
      openWinBack
    };
  }
});
