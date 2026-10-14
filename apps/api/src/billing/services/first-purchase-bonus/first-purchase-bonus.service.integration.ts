import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import { TxService } from "@src/core/services/tx/tx.service";
import { FirstPurchaseBonusService } from "./first-purchase-bonus.service";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const QUALIFYING_AMOUNT_CENTS = 100_00;

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
      const { stripeTransactionRepository, pendingPurchase, eligibleBonusAmount } = setup();
      const person = await seedUser();
      const { organization: team } = await seedOrganizationWithOwner();
      await stripeTransactionRepository.create({ userId: person.id, type: "payment_intent", status: "succeeded", amount: 2000, currency: "usd" });
      const purchase = await pendingPurchase(person.id, team.id);

      await expect(eligibleBonusAmount(purchase)).resolves.toBe(QUALIFYING_AMOUNT_CENTS / 10);
    });

    it("refuses the bonus to a person whose bonused purchase was refunded", async () => {
      const { stripeTransactionRepository, pendingPurchase, eligibleBonusAmount } = setup();
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

      await expect(eligibleBonusAmount(purchase)).resolves.toBe(0);
    });
  });

  function setup() {
    const service = container.resolve(FirstPurchaseBonusService);
    const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
    const txService = container.resolve(TxService);

    const pendingPurchase = (userId: string, organizationId: string) =>
      stripeTransactionRepository.create({
        userId,
        organizationId,
        type: "payment_intent",
        status: "pending",
        amount: QUALIFYING_AMOUNT_CENTS,
        currency: "usd"
      });

    const settleConcurrently = async (purchases: StripeTransactionOutput[]) => {
      await Promise.all(
        purchases.map(purchase =>
          txService.transaction(async () => {
            const bonusAmount = await service.getEligibleBonusAmount(purchase, QUALIFYING_AMOUNT_CENTS);
            await delay(100);
            await stripeTransactionRepository.updateById(purchase.id, { status: "succeeded", bonusAmount });
          })
        )
      );

      const settled = await Promise.all(purchases.map(purchase => stripeTransactionRepository.findById(purchase.id)));

      return settled.map(purchase => purchase!.bonusAmount);
    };

    const eligibleBonusAmount = (purchase: StripeTransactionOutput) =>
      txService.transaction(() => service.getEligibleBonusAmount(purchase, QUALIFYING_AMOUNT_CENTS));

    return { stripeTransactionRepository, pendingPurchase, settleConcurrently, eligibleBonusAmount };
  }
});
