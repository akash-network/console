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

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
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

  async function setup(input: { balanceUsd: number; autoReloadEnabled?: boolean; autoReloadPausedAt?: Date; lastAutoChargeAt?: Date }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const walletSettingTable = resolveTable("WalletSetting");

    const { user, wallet } = await seedUserWithWallet({
      isTrialing: false,
      activatedAt: new Date(),
      user: { email: "reload@example.com", stripeCustomerId: STRIPE_CUSTOMER_ID }
    });

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
      paymentMethodId,
      fingerprint: `fp_${faker.string.alphanumeric(12)}`,
      isDefault: true,
      isValidated: true
    });

    vi.spyOn(container.resolve<Stripe>(STRIPE_CLIENT).paymentMethods, "retrieve").mockResolvedValue(
      mock<Stripe.Response<Stripe.PaymentMethod>>({ id: paymentMethodId, customer: STRIPE_CUSTOMER_ID })
    );
    vi.spyOn(container.resolve(BalancesService), "getDeploymentBalanceInFiat").mockResolvedValue(input.balanceUsd);
    const createPaymentIntent = vi
      .spyOn(container.resolve(StripeTransactionService), "createPaymentIntent")
      .mockResolvedValue({ success: true, transactionId: "tx_test", paymentIntentId: "pi_test", transactionStatus: "succeeded" });

    const checkKey = `${WalletBalanceReloadCheck.name}.${user.id}`;

    return {
      paymentMethodId,
      createPaymentIntent,
      findWalletSetting: async () => {
        const [row] = await db.select().from(walletSettingTable).where(eq(walletSettingTable.id, walletSetting.id));

        return row;
      },
      checkBalance: async () => {
        await enqueue(new WalletBalanceReloadCheck({ userId: user.id, triggeredByDeployment: true }), { singletonKey: checkKey });
        await startWorkers();
        await expectJobCompleted(WalletBalanceReloadCheck[JOB_NAME], { singletonKey: checkKey, state: "completed" });
      }
    };
  }
});
