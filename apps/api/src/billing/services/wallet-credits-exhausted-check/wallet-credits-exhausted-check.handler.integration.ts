import "@src/app/providers/jobs.provider";

import { addHours, subDays } from "date-fns";
import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { WalletCreditsExhaustedCheck } from "@src/billing/events/wallet-credits-exhausted-check";
import { WalletCreditsExhaustedCheckHandler } from "@src/billing/services/wallet-credits-exhausted-check/wallet-credits-exhausted-check.handler";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";
import { interceptNotifications } from "@test/services/notifications-intercept";

const jobWorkers = useJobWorkers(() => [container.resolve(WalletCreditsExhaustedCheckHandler)]);

describe(WalletCreditsExhaustedCheckHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("warns a user the credits-low email already reached and stamps the wallet", async () => {
    const { checkCredits, findWallet, sentNotifications } = await setup({ creditsLowNotifiedAt: subDays(new Date(), 2) });

    await checkCredits();

    expect(sentNotifications()).toHaveLength(1);
    expect(sentNotifications()[0].body).toMatchObject({ notificationId: expect.stringMatching(/^creditsExhausted\./) });
    expect(await findWallet()).toMatchObject({ creditsExhaustedNotifiedAt: expect.any(Date) });
  });

  it("warns once per low episode however many funding passes ask", async () => {
    const { checkCredits, sentNotifications } = await setup({ creditsLowNotifiedAt: subDays(new Date(), 2) });

    await checkCredits({ firstClosingDseq: "1234567" });
    await checkCredits({ firstClosingDseq: "7654321" });

    expect(sentNotifications()).toHaveLength(1);
  });

  it("does not warn before the credits-low email has gone out", async () => {
    const { checkCredits, findWallet, sentNotifications } = await setup({ creditsLowNotifiedAt: null });

    await checkCredits();

    expect(sentNotifications()).toHaveLength(0);
    expect(await findWallet()).toMatchObject({ creditsExhaustedNotifiedAt: null });
  });

  it("does not warn a user whose Auto Recharge is on", async () => {
    const { checkCredits, sentNotifications } = await setup({ creditsLowNotifiedAt: subDays(new Date(), 2), autoReload: true });

    await checkCredits();

    expect(sentNotifications()).toHaveLength(0);
  });

  it("does not warn a trialing user", async () => {
    const { checkCredits, sentNotifications } = await setup({ creditsLowNotifiedAt: subDays(new Date(), 2), isTrialing: true });

    await checkCredits();

    expect(sentNotifications()).toHaveLength(0);
  });

  async function setup(input: { creditsLowNotifiedAt: Date | null; autoReload?: boolean; isTrialing?: boolean }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const userWalletsTable = resolveTable("UserWallets");

    const { user, wallet } = await seedUserWithWallet({
      isTrialing: input.isTrialing ?? false,
      activatedAt: new Date(),
      creditsLowNotifiedAt: input.creditsLowNotifiedAt,
      user: { email: "credits-exhausted@example.com" }
    });

    await seedWalletSetting({ userId: user.id, walletId: wallet.id, autoReloadEnabled: input.autoReload ?? false });

    const sentNotifications = interceptNotifications();
    const checkKey = `${WalletCreditsExhaustedCheck.name}.${user.id}`;

    return {
      sentNotifications,
      findWallet: async () => {
        const [row] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.id, wallet.id));

        return row;
      },
      checkCredits: async ({ firstClosingDseq }: { firstClosingDseq: string } = { firstClosingDseq: "1234567" }) => {
        await enqueue(
          new WalletCreditsExhaustedCheck({
            userId: user.id,
            firstClosingDseq,
            unfundedDeploymentCount: 1,
            firstClosureAt: addHours(new Date(), 20).toISOString()
          }),
          { singletonKey: checkKey }
        );
        await startWorkers();
        await expectJobCompleted(WalletCreditsExhaustedCheck[JOB_NAME], { singletonKey: checkKey, data: { firstClosingDseq } });
      }
    };
  }
});
