import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { WalletBalanceReloadCheckHandler } from "@src/billing/services/wallet-balance-reload-check/wallet-balance-reload-check.handler";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";

import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet, seedPersonalOrganizationIdOf, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const STRIPE_CUSTOMER_ID = "cus_test_reload";
const THRESHOLD_CENTS = 2_000;
const RELOAD_AMOUNT_CENTS = 5_000;

const jobWorkers = useJobWorkers(() => [container.resolve(WalletBalanceReloadCheckHandler)]);

describe(WalletBalanceReloadCheckHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("charges the default payment method once the balance falls below the threshold", async () => {
    const { checkBalance, createPaymentIntent, findWalletSetting, paymentMethodId } = await setup({ balanceUsd: 1 });

    await checkBalance();

    expect(createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: paymentMethodId, customer: STRIPE_CUSTOMER_ID, confirm: true, offSession: true })
    );
    expect((await findWalletSetting()).lastAutoChargeAt).toBeInstanceOf(Date);
  });

  it("charges nothing while the balance still covers the threshold", async () => {
    const { checkBalance, createPaymentIntent } = await setup({ balanceUsd: 100 });

    await checkBalance();

    expect(createPaymentIntent).not.toHaveBeenCalled();
  });

  it("charges nothing for a wallet paused after repeated declines", async () => {
    const { checkBalance, createPaymentIntent } = await setup({ balanceUsd: 1, autoReloadPausedAt: new Date() });

    await checkBalance();

    expect(createPaymentIntent).not.toHaveBeenCalled();
  });

  it("charges nothing a second time inside the cooldown the first charge claimed", async () => {
    const { checkBalance, createPaymentIntent } = await setup({ balanceUsd: 1, lastAutoChargeAt: new Date() });

    await checkBalance();

    expect(createPaymentIntent).not.toHaveBeenCalled();
  });

  it("charges nothing for a wallet whose auto reload is off", async () => {
    const { checkBalance, createPaymentIntent } = await setup({ balanceUsd: 1, autoReloadEnabled: false });

    await checkBalance();

    expect(createPaymentIntent).not.toHaveBeenCalled();
  });

  it("charges nothing when auto reload is turned off after the check read the wallet's setting", async () => {
    const { checkBalance, createPaymentIntent, findWalletSetting } = await setup({ balanceUsd: 1, whileChecking: "auto_reload_turned_off" });

    await checkBalance();

    expect(createPaymentIntent).not.toHaveBeenCalled();
    expect((await findWalletSetting()).autoReloadEnabled).toBe(false);
  });

  it("charges a team's wallet whose team still exists", async () => {
    const { checkBalance, createPaymentIntent, payerOrganizationId, stripeCustomerId } = await setup({ balanceUsd: 1, team: true });

    await checkBalance();

    expect(createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ organizationId: payerOrganizationId, customer: stripeCustomerId }));
  });

  it("charges nothing when the team is deleted after the check read its wallet's setting", async () => {
    const { checkBalance, createPaymentIntent } = await setup({ balanceUsd: 1, team: true, whileChecking: "team_deleted" });

    await checkBalance();

    expect(createPaymentIntent).not.toHaveBeenCalled();
  });

  async function setup(input: {
    balanceUsd: number;
    autoReloadEnabled?: boolean;
    autoReloadPausedAt?: Date;
    lastAutoChargeAt?: Date;
    team?: boolean;
    whileChecking?: "auto_reload_turned_off" | "team_deleted";
  }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const walletSettingTable = resolveTable("WalletSetting");

    const { user, wallet, team, stripeCustomerId } = input.team ? await seedTeamWallet() : await seedPersonalWallet();

    const walletSetting = await seedWalletSetting({
      userId: user.id,
      walletId: wallet.id,
      autoReloadEnabled: input.autoReloadEnabled ?? true,
      autoReloadMode: "threshold",
      autoReloadThreshold: THRESHOLD_CENTS,
      autoReloadAmount: RELOAD_AMOUNT_CENTS,
      autoReloadPausedAt: input.autoReloadPausedAt ?? null,
      lastAutoChargeAt: input.lastAutoChargeAt ?? null
    });

    const paymentMethodId = `pm_${faker.string.alphanumeric(12)}`;
    await db.insert(resolveTable("PaymentMethods")).values({
      userId: user.id,
      organizationId: team?.id ?? (await seedPersonalOrganizationIdOf(user.id)),
      paymentMethodId,
      fingerprint: `fp_${faker.string.alphanumeric(12)}`,
      isDefault: true,
      isValidated: true
    });

    vi.spyOn(container.resolve<Stripe>(STRIPE_CLIENT).paymentMethods, "retrieve").mockResolvedValue(
      mock<Stripe.Response<Stripe.PaymentMethod>>({ id: paymentMethodId, customer: stripeCustomerId })
    );
    vi.spyOn(container.resolve(BalancesService), "getDeploymentBalanceInFiat").mockImplementation(async () => {
      if (input.whileChecking === "auto_reload_turned_off") {
        await db.update(walletSettingTable).set({ autoReloadEnabled: false }).where(eq(walletSettingTable.id, walletSetting.id));
      }

      if (input.whileChecking === "team_deleted" && team) {
        await db
          .update(resolveTable("Organizations"))
          .set({ deletedAt: new Date() })
          .where(eq(resolveTable("Organizations").id, team.id));
      }

      return input.balanceUsd;
    });
    const createPaymentIntent = vi
      .spyOn(container.resolve(StripeTransactionService), "createPaymentIntent")
      .mockResolvedValue({ success: true, transactionId: "tx_test", paymentIntentId: "pi_test", transactionStatus: "succeeded" });

    const checkKey = `${WalletBalanceReloadCheck.name}.${wallet.id}`;
    const check = team
      ? new WalletBalanceReloadCheck({ walletId: wallet.id, triggeredByDeployment: true })
      : new WalletBalanceReloadCheck({ userId: user.id, triggeredByDeployment: true });

    return {
      paymentMethodId,
      payerOrganizationId: team?.id,
      stripeCustomerId,
      createPaymentIntent,
      findWalletSetting: async () => {
        const [row] = await db.select().from(walletSettingTable).where(eq(walletSettingTable.id, walletSetting.id));

        return row;
      },
      checkBalance: async () => {
        await enqueue(check, { singletonKey: checkKey });
        await startWorkers();
        await expectJobCompleted(WalletBalanceReloadCheck[JOB_NAME], { singletonKey: checkKey, state: "completed" });
      }
    };
  }

  async function seedPersonalWallet() {
    const { user, wallet } = await seedUserWithWallet({
      isTrialing: false,
      activatedAt: new Date(),
      user: { email: "reload@example.com", stripeCustomerId: STRIPE_CUSTOMER_ID }
    });

    return { user, wallet, team: undefined, stripeCustomerId: STRIPE_CUSTOMER_ID };
  }

  async function seedTeamWallet() {
    const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
    const { user, organization: team } = await seedOrganizationWithOwner({ stripeCustomerId });
    const wallet = await seedOrganizationWallet({ organizationId: team.id, activatedAt: new Date() });

    return { user, wallet, team, stripeCustomerId };
  }
});
