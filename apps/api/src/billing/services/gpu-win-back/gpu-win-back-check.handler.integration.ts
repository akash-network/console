import { faker } from "@faker-js/faker";
import { addDays, differenceInSeconds, subDays, subMinutes } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { FirstPurchaseBonusWindowOpenedHandler } from "@src/app/services/first-purchase-bonus-window-opened/first-purchase-bonus-window-opened.handler";
import { FirstPurchaseBonusWindowReminderHandler } from "@src/app/services/first-purchase-bonus-window-reminder/first-purchase-bonus-window-reminder.handler";
import { FirstPurchaseBonusWindowReminderJob } from "@src/app/services/first-purchase-bonus-window-reminder/first-purchase-bonus-window-reminder.job";
import { FirstPurchaseBonusWindowOpened } from "@src/billing/events/first-purchase-bonus-window-opened";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { FirstPurchaseBonusWinBackRepository } from "@src/billing/repositories/first-purchase-bonus-win-back/first-purchase-bonus-win-back.repository";
import { CHAIN_DB } from "@src/chain";
import { BlockRepository } from "@src/chain/repositories/block.repository";
import { JOB_NAME } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { UserRepository } from "@src/user/repositories";
import { GpuWinBackCheckHandler } from "./gpu-win-back-check.handler";
import { GpuWinBackCheck, gpuWinBackCheckKeyFor } from "./gpu-win-back-check.job";

import { createAkashBlock, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";
import { holdTransaction, waitForLockWait } from "@test/services/lock-wait";

const CHECK_JOB = GpuWinBackCheck[JOB_NAME];
const WINDOW_OPENED_EVENT = FirstPurchaseBonusWindowOpened[JOB_NAME];
const REMINDER_JOB = FirstPurchaseBonusWindowReminderJob[JOB_NAME];
const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const LATEST_BLOCK_PATH = "/cosmos/base/tendermint/v1beta1/blocks/latest";
const TIME_TOLERANCE_SECONDS = 120;

const jobWorkers = useJobWorkers(() => [
  container.resolve(GpuWinBackCheckHandler),
  container.resolve(FirstPurchaseBonusWindowOpenedHandler),
  container.resolve(FirstPurchaseBonusWindowReminderHandler)
]);

type SentNotification = { notificationId: string; payload: { summary: string } };

describe(GpuWinBackCheckHandler.name, () => {
  beforeAll(() => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", faker.string.alphanumeric(32));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("opens a 7-day win-back for a small buyer whose gpu deployment closed over a week ago, emails it and schedules its reminder", async () => {
    const { person, payOnPersonalAccount, runGpuDeployment, check, findWinBack, notifications } = await setup();
    await payOnPersonalAccount(20_00);
    await runGpuDeployment({ createdAt: subDays(new Date(), 10), isOpen: false });

    await check();

    const winBack = await findWinBack();
    expectAbout(winBack?.closesAt, addDays(new Date(), 7));
    await expectJobCompleted(WINDOW_OPENED_EVENT, { data: { userId: person.id } });
    expect(notifications.map(({ notificationId, payload }) => ({ notificationId, summary: payload.summary }))).toEqual([
      { notificationId: `firstPurchaseBonusWindowOpened.gpu_win_back.${person.id}`, summary: "10% bonus credits, this week only" }
    ]);
    const [reminder] = await findJobRows(REMINDER_JOB, { singletonKey: `firstPurchaseBonusWindowReminder.gpu_win_back.${person.id}` });
    expect(new Date(reminder.start_after)).toEqual(subDays(winBack!.closesAt!, 1));
  });

  it("opens a win-back without a deadline for a person who never paid, emails it and schedules no reminder", async () => {
    const { person, runGpuDeployment, check, findWinBack, notifications } = await setup({ isTrialing: true });
    await runGpuDeployment({ createdAt: subDays(new Date(), 10), isOpen: false });

    await check();

    await expect(findWinBack()).resolves.toMatchObject({ userId: person.id, closesAt: null });
    await expectJobCompleted(WINDOW_OPENED_EVENT, { data: { userId: person.id } });
    expect(notifications.map(({ payload }) => payload.summary)).toEqual(["Your first purchase comes with bonus credits"]);
    expect(await findJobRows(REMINDER_JOB, { data: { userId: person.id } })).toEqual([]);
  });

  it("checks again tomorrow while the person still runs a deployment", async () => {
    const { person, payOnPersonalAccount, runGpuDeployment, check, findWinBack } = await setup();
    await payOnPersonalAccount(20_00);
    await runGpuDeployment({ createdAt: subDays(new Date(), 10), isOpen: true });

    await check();

    await expect(findWinBack()).resolves.toBeUndefined();
    const [successor] = await findJobRows(CHECK_JOB, { singletonKey: gpuWinBackCheckKeyFor(person.id), state: "created" });
    expectAbout(new Date(successor.start_after), addDays(new Date(), 1));
  });

  it("checks again later rather than trust an indexer that trails the chain", async () => {
    const { person, payOnPersonalAccount, runGpuDeployment, check, findWinBack } = await setup({ chainBlocksAhead: 1_000 });
    await payOnPersonalAccount(20_00);
    await runGpuDeployment({ createdAt: subDays(new Date(), 10), isOpen: false });

    await check();

    await expect(findWinBack()).resolves.toBeUndefined();
    await expect(findJobRows(CHECK_JOB, { singletonKey: gpuWinBackCheckKeyFor(person.id), state: "created" })).resolves.toHaveLength(1);
  });

  it("offers nothing to a person whose personal account once bought $100 or more", async () => {
    const { person, payOnPersonalAccount, runGpuDeployment, check, findWinBack } = await setup();
    await payOnPersonalAccount(100_00);
    await runGpuDeployment({ createdAt: subDays(new Date(), 10), isOpen: false });

    await check();

    await expect(findWinBack()).resolves.toBeUndefined();
    expect(await findJobRows(WINDOW_OPENED_EVENT, { data: { userId: person.id } })).toEqual([]);
  });

  it("offers nothing to a person whose $100 purchase settles while the check waits on them", async () => {
    const { person, payOnPersonalAccount, runGpuDeployment, startCheck, waitForCheck, findWinBack } = await setup();
    await payOnPersonalAccount(20_00);
    await runGpuDeployment({ createdAt: subDays(new Date(), 10), isOpen: false });
    const settlement = holdTransaction(async () => {
      await container.resolve(UserRepository).findOneByAndLock({ id: person.id }, { strength: "no key update" });
      await container
        .resolve(StripeTransactionRepository)
        .create({ userId: person.id, type: "payment_intent", status: "succeeded", amount: 100_00, currency: "usd" });
    });
    await settlement.held;

    await startCheck();
    await waitForLockWait('select %from "userSetting"%for no key update');
    settlement.release();
    await settlement.committed;
    await waitForCheck();

    await expect(findWinBack()).resolves.toBeUndefined();
    expect(await findJobRows(WINDOW_OPENED_EVENT, { data: { userId: person.id } })).toEqual([]);
  });

  function expectAbout(actual: Date | null | undefined, expected: Date) {
    expect(Math.abs(differenceInSeconds(actual!, expected))).toBeLessThan(TIME_TOLERANCE_SECONDS);
  }

  async function setup(input: { isTrialing?: boolean; chainBlocksAhead?: number } = {}) {
    container.resolve(CHAIN_DB);
    const { enqueue, startWorkers } = await jobWorkers();
    const { user: person, address } = await seedUserWithWallet({
      isTrialing: input.isTrialing ?? false,
      activatedAt: subDays(new Date(), 90),
      user: { email: faker.internet.email() }
    });
    const notifications: SentNotification[] = [];
    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .persist()
      .post(NOTIFICATION_PATH)
      .reply((_uri, body) => {
        notifications.push(body as SentNotification);
        return [204];
      });

    async function payOnPersonalAccount(amount: number) {
      await container.resolve(StripeTransactionRepository).create({
        userId: person.id,
        type: "payment_intent",
        status: "succeeded",
        amount,
        currency: "usd",
        createdAt: subDays(new Date(), 40)
      });
    }

    async function runGpuDeployment({ createdAt, isOpen }: { createdAt: Date; isOpen: boolean }) {
      const createdHeight = await seedProcessedBlock(createdAt);
      const closedHeight = isOpen ? undefined : await seedProcessedBlock(addDays(createdAt, 1));
      const deployment = await createDeployment({ owner: address, dseq: faker.string.numeric(12), createdHeight, closedHeight });
      const group = await createDeploymentGroup({ deploymentId: deployment.id, owner: address, dseq: deployment.dseq, gseq: 1 });
      const provider = await createProvider();
      await createLease({
        deploymentId: deployment.id,
        deploymentGroupId: group.id,
        owner: address,
        dseq: deployment.dseq,
        gseq: 1,
        oseq: 1,
        providerAddress: provider.owner,
        gpuUnits: 1,
        closedHeight
      });
    }

    async function startCheck() {
      await seedProcessedBlock(subMinutes(new Date(), 1));
      const indexedHeight = await container.resolve(BlockRepository).getLatestProcessedHeight();
      nock(container.resolve(CoreConfigService).get("REST_API_NODE_URL"))
        .persist()
        .get(LATEST_BLOCK_PATH)
        .query(true)
        .reply(200, { block_id: {}, block: { header: { height: String(indexedHeight + (input.chainBlocksAhead ?? 0)), chain_id: "akashnet-2" } } });

      await enqueue(new GpuWinBackCheck({ userId: person.id }), { singletonKey: gpuWinBackCheckKeyFor(person.id) });
      await startWorkers();
    }

    async function waitForCheck() {
      await expectJobCompleted(CHECK_JOB, { singletonKey: gpuWinBackCheckKeyFor(person.id), state: "completed" });
    }

    async function check() {
      await startCheck();
      await waitForCheck();
    }

    return {
      person,
      payOnPersonalAccount,
      runGpuDeployment,
      startCheck,
      waitForCheck,
      check,
      findWinBack: () => container.resolve(FirstPurchaseBonusWinBackRepository).findByUserId(person.id),
      notifications
    };
  }
});

let nextBlockHeight = 40_000_000;

async function seedProcessedBlock(datetime: Date): Promise<number> {
  nextBlockHeight += 1;
  await createAkashBlock({ height: nextBlockHeight, datetime, isProcessed: true });

  return nextBlockHeight;
}
