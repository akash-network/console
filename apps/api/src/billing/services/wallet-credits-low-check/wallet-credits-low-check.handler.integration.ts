import "@src/app/providers/jobs.provider";

import { subMinutes } from "date-fns";
import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { WalletCreditsLowCheckHandler } from "@src/billing/services/wallet-credits-low-check/wallet-credits-low-check.handler";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";
import { interceptNotifications } from "@test/services/notifications-intercept";

/** Longer than CREDITS_LOW_CONFIRM_WINDOW_MIN, so a streak stamped this long ago counts as confirmed. */
const PAST_THE_CONFIRM_WINDOW_IN_MIN = 45;

/** Longer than CREDITS_LOW_RECOVERY_CONFIRM_WINDOW_MIN, so a recovery stamped this long ago counts as held. */
const PAST_THE_RECOVERY_WINDOW_IN_MIN = 24 * 60 * 3;

const jobWorkers = useJobWorkers(() => [container.resolve(WalletCreditsLowCheckHandler)]);

describe(WalletCreditsLowCheckHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("opens the low window on a first low reading without emailing", async () => {
    const { checkCredits, findWallet, sentNotifications } = await setup({ balanceUsd: 1, weeklyCostUsd: 20 });

    await checkCredits();

    expect(await findWallet()).toMatchObject({ creditsLowSince: expect.any(Date), creditsLowNotifiedAt: null });
    expect(sentNotifications()).toHaveLength(0);
  });

  it("stays quiet while the low reading is still inside the confirm window", async () => {
    const { checkCredits, sentNotifications } = await setup({ balanceUsd: 1, weeklyCostUsd: 20, creditsLowSince: new Date() });

    await checkCredits();

    expect(sentNotifications()).toHaveLength(0);
  });

  it("emails once the low streak has held past the confirm window", async () => {
    const { checkCredits, findWallet, sentNotifications } = await setup({
      balanceUsd: 1,
      weeklyCostUsd: 20,
      creditsLowSince: subMinutes(new Date(), PAST_THE_CONFIRM_WINDOW_IN_MIN)
    });

    await checkCredits();

    expect(sentNotifications()).toHaveLength(1);
    expect(await findWallet()).toMatchObject({ creditsLowNotifiedAt: expect.any(Date), creditsLowSince: null, creditsSufficientSince: null });
  });

  it("emails nothing a second time for a wallet already notified, and ends its recovery streak", async () => {
    const { checkCredits, findWallet, sentNotifications } = await setup({
      balanceUsd: 1,
      weeklyCostUsd: 20,
      creditsLowSince: subMinutes(new Date(), PAST_THE_CONFIRM_WINDOW_IN_MIN),
      creditsLowNotifiedAt: new Date(),
      creditsSufficientSince: subMinutes(new Date(), 5)
    });

    await checkCredits();

    expect(sentNotifications()).toHaveLength(0);
    expect(await findWallet()).toMatchObject({ creditsSufficientSince: null });
  });

  it("emails nothing for a wallet whose auto reload is on", async () => {
    const { checkCredits, sentNotifications, findWallet } = await setup({
      balanceUsd: 1,
      weeklyCostUsd: 20,
      creditsLowSince: subMinutes(new Date(), PAST_THE_CONFIRM_WINDOW_IN_MIN),
      autoReload: true
    });

    await checkCredits();

    expect(sentNotifications()).toHaveLength(0);
    expect(await findWallet()).toMatchObject({ creditsLowNotifiedAt: null });
  });

  it("clears the notice at once when there is nothing left to top up", async () => {
    const { checkCredits, findWallet } = await setup({
      balanceUsd: 1,
      weeklyCostUsd: 0,
      hasAutoTopUpSettings: false,
      creditsLowNotifiedAt: new Date()
    });

    await checkCredits();

    expect(await findWallet()).toMatchObject({ creditsLowNotifiedAt: null, creditsSufficientSince: null, creditsLowSince: null });
  });

  it("opens the recovery window on a balance that covers the week again", async () => {
    const { checkCredits, findWallet } = await setup({ balanceUsd: 50, weeklyCostUsd: 20, creditsLowNotifiedAt: new Date() });

    await checkCredits();

    expect(await findWallet()).toMatchObject({ creditsSufficientSince: expect.any(Date), creditsLowNotifiedAt: expect.any(Date) });
  });

  it("clears the notice once the recovery has held past its window", async () => {
    const { checkCredits, findWallet } = await setup({
      balanceUsd: 50,
      weeklyCostUsd: 20,
      creditsLowNotifiedAt: new Date(),
      creditsSufficientSince: subMinutes(new Date(), PAST_THE_RECOVERY_WINDOW_IN_MIN)
    });

    await checkCredits();

    expect(await findWallet()).toMatchObject({ creditsLowNotifiedAt: null });
  });

  it("emails nothing for a wallet still on trial", async () => {
    const { checkCredits, sentNotifications } = await setup({
      balanceUsd: 1,
      weeklyCostUsd: 20,
      creditsLowSince: subMinutes(new Date(), PAST_THE_CONFIRM_WINDOW_IN_MIN),
      isTrialing: true
    });

    await checkCredits();

    expect(sentNotifications()).toHaveLength(0);
  });

  async function setup(input: {
    balanceUsd: number;
    weeklyCostUsd: number;
    creditsLowSince?: Date;
    creditsLowNotifiedAt?: Date;
    creditsSufficientSince?: Date;
    autoReload?: boolean;
    isTrialing?: boolean;
    hasAutoTopUpSettings?: boolean;
  }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const userWalletsTable = resolveTable("UserWallets");

    const { user, wallet, address } = await seedUserWithWallet({
      isTrialing: input.isTrialing ?? false,
      activatedAt: new Date(),
      creditsLowSince: input.creditsLowSince ?? null,
      creditsLowNotifiedAt: input.creditsLowNotifiedAt ?? null,
      creditsSufficientSince: input.creditsSufficientSince ?? null,
      user: { email: "credits-low@example.com" }
    });

    await seedWalletSetting({ userId: user.id, walletId: wallet.id, autoReloadEnabled: input.autoReload ?? false });

    vi.spyOn(container.resolve(BalancesService), "getDeploymentBalanceInFiat").mockResolvedValue(input.balanceUsd);
    vi.spyOn(container.resolve(DrainingDeploymentService), "calculateWeeklyCoverageForAddress").mockResolvedValue({
      weeklyCostUsd: input.weeklyCostUsd,
      cumulativeDailyCostsUsd: [1, 5, 10, 15, 20, 25, 30],
      hasAutoTopUpSettings: input.hasAutoTopUpSettings ?? true
    });

    const sentNotifications = interceptNotifications();
    const checkKey = `${WalletCreditsLowCheck.name}.${user.id}`;

    return {
      address,
      sentNotifications,
      findWallet: async () => {
        const [row] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.id, wallet.id));

        return row;
      },
      checkCredits: async () => {
        await enqueue(new WalletCreditsLowCheck({ userId: user.id }), { singletonKey: checkKey });
        await startWorkers();
        await expectJobCompleted(WalletCreditsLowCheck[JOB_NAME], { singletonKey: checkKey });
      }
    };
  }
});
