import "@src/app/providers/jobs.provider";

import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutoRechargeSucceeded } from "@src/billing/events/auto-recharge-succeeded";
import { FirstPurchaseBonusGranted } from "@src/billing/events/first-purchase-bonus-granted";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { DOMAIN_EVENT_NAME } from "@src/core/services/domain-events/domain-events.service";
import { FirstPurchaseBonusGrantedHandler } from "../first-purchase-bonus-granted/first-purchase-bonus-granted.handler";
import { AutoRechargeSucceededHandler } from "./auto-recharge-succeeded.handler";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";
import { interceptNotifications } from "@test/services/notifications-intercept";

const BALANCE_USD = 42.5;

const jobWorkers = useJobWorkers(() => [container.resolve(AutoRechargeSucceededHandler), container.resolve(FirstPurchaseBonusGrantedHandler)]);

describe("recharge and bonus notices", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe(AutoRechargeSucceededHandler.name, () => {
    it("tells the owner what was charged and what the balance now is", async () => {
      const { userId, rechargeSucceeded, sentNotifications } = await setup();

      await rechargeSucceeded({ amountCents: 2500 });

      const [sent] = sentNotifications();
      expect(sent.userId).toBe(userId);
      expect(sent.body).toMatchObject({
        notificationId: "autoRechargeSucceeded.pi_test_recharge",
        payload: {
          summary: "Your Akash account was recharged $25.00",
          description: expect.stringContaining("balance is now <strong>$42.50</strong>")
        }
      });
    });

    it("says nothing to a user with no email", async () => {
      const { rechargeSucceeded, sentNotifications } = await setup({ email: null });

      await rechargeSucceeded({ amountCents: 2500 });

      expect(sentNotifications()).toHaveLength(0);
    });

    it("says nothing when the wallet has no address to read a balance for", async () => {
      const { rechargeSucceeded, sentNotifications } = await setup({ address: null });

      await rechargeSucceeded({ amountCents: 2500 });

      expect(sentNotifications()).toHaveLength(0);
    });
  });

  describe(FirstPurchaseBonusGrantedHandler.name, () => {
    it("tells the owner what bonus the purchase earned", async () => {
      const { userId, bonusGranted, sentNotifications } = await setup();

      await bonusGranted({ bonusAmountCents: 1000, paidAmountCents: 5000 });

      const [sent] = sentNotifications();
      expect(sent.userId).toBe(userId);
      expect(sent.body).toMatchObject({
        notificationId: `firstPurchaseBonusGranted.${userId}`,
        payload: {
          summary: "You earned $10.00 in bonus credits",
          description: expect.stringContaining("first purchase of $50.00")
        }
      });
    });

    it("says nothing to a user with no email", async () => {
      const { bonusGranted, sentNotifications } = await setup({ email: null });

      await bonusGranted({ bonusAmountCents: 1000, paidAmountCents: 5000 });

      expect(sentNotifications()).toHaveLength(0);
    });

    it("says nothing to a user who no longer exists", async () => {
      const { bonusGrantedFor, sentNotifications } = await setup();

      await bonusGrantedFor("00000000-0000-0000-0000-000000000000", { bonusAmountCents: 1000, paidAmountCents: 5000 });

      expect(sentNotifications()).toHaveLength(0);
    });
  });

  async function setup(input: { email?: string | null; address?: string | null } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const email = input.email === undefined ? "recharge@example.com" : input.email;
    const { user } = await seedUserWithWallet({
      ...(input.address === null ? { address: null } : {}),
      user: { email }
    });

    vi.spyOn(container.resolve(BalancesService), "getDeploymentBalanceInFiat").mockResolvedValue(BALANCE_USD);
    const sentNotifications = interceptNotifications();

    return {
      userId: user.id,
      sentNotifications,
      rechargeSucceeded: async (amounts: { amountCents: number }) => {
        await enqueue(new AutoRechargeSucceeded({ userId: user.id, transactionId: "pi_test_recharge", ...amounts }));
        await startWorkers();
        await expectJobCompleted(AutoRechargeSucceeded[DOMAIN_EVENT_NAME], { data: { userId: user.id } });
      },
      bonusGranted: async (amounts: { bonusAmountCents: number; paidAmountCents: number }) => {
        await enqueue(new FirstPurchaseBonusGranted({ userId: user.id, ...amounts }));
        await startWorkers();
        await expectJobCompleted(FirstPurchaseBonusGranted[DOMAIN_EVENT_NAME], { data: { userId: user.id } });
      },
      bonusGrantedFor: async (userId: string, amounts: { bonusAmountCents: number; paidAmountCents: number }) => {
        await enqueue(new FirstPurchaseBonusGranted({ userId, ...amounts }));
        await startWorkers();
        await expectJobCompleted(FirstPurchaseBonusGranted[DOMAIN_EVENT_NAME], { data: { userId } });
      }
    };
  }
});
