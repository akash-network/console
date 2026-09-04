import { hoursToMilliseconds } from "date-fns";
import { and, eq, sql } from "drizzle-orm";
import { container } from "tsyringe";
import type { MockInstance } from "vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { UserRepository } from "@src/user/repositories";
import { ExpiringDeploymentsNotifierService } from "./expiring-deployments-notifier.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

/**
 * Covers which rows the sweep picks up and the once-per-deadline rule, both of which are pure SQL:
 * the lead window against `now()`, the minimum-limit and trial guards, and the claim that keeps a
 * second pass from resending. Delivery is stubbed at the notification boundary, which has its own tests.
 */
describe(ExpiringDeploymentsNotifierService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emails the owner of a deployment approaching its limit and stamps the deadline it warned about", async () => {
    const { notifier, createUserWithWallet, createDeploymentSetting, findSetting, createNotification } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "300001";
    const runtimeEndsAt = hoursFromNow(3);
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 24, runtimeEndsAt });

    const result = await notifier.notifyExpiringDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          actions: [expect.objectContaining({ url: expect.stringContaining(`/deployments/${dseq}?tab=SETTINGS`) })]
        })
      })
    );
    expect(await findSetting(user.id, dseq)).toMatchObject({ runtimeEndingNotifiedFor: runtimeEndsAt });
  });

  it("emails a deployment whose deadline was anchored by the countdown rather than written as a Date", async () => {
    const { notifier, createUserWithWallet, createDeploymentSetting, startCountdown, findSetting, createNotification } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "300009";
    const setting = await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 24, runtimeEndsAt: null });
    await startCountdown(setting.id, 21);

    const result = await notifier.notifyExpiringDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(countNotificationsFor(createNotification, dseq)).toBe(1);
    expect((await findSetting(user.id, dseq)).runtimeEndingNotifiedFor).not.toBeNull();
  });

  it("warns on the next sweep when the first email failed to send", async () => {
    const { notifier, createUserWithWallet, createDeploymentSetting, findSetting, createNotification } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "300010";
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 24, runtimeEndsAt: hoursFromNow(3) });
    createNotification.mockRejectedValueOnce(new Error("notifications api down"));

    const failed = await notifier.notifyExpiringDeployments({ dryRun: false });
    expect(failed.err).toBe(true);
    expect((await findSetting(user.id, dseq)).runtimeEndingNotifiedFor).toBeNull();

    const retried = await notifier.notifyExpiringDeployments({ dryRun: false });

    expect(retried.ok).toBe(true);
    expect(countNotificationsFor(createNotification, dseq)).toBe(2);
    expect((await findSetting(user.id, dseq)).runtimeEndingNotifiedFor).not.toBeNull();
  });

  it("sends only one email for the same deadline across repeated sweeps", async () => {
    const { notifier, createUserWithWallet, createDeploymentSetting, createNotification } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "300002";
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 24, runtimeEndsAt: hoursFromNow(3) });

    await notifier.notifyExpiringDeployments({ dryRun: false });
    await notifier.notifyExpiringDeployments({ dryRun: false });

    expect(countNotificationsFor(createNotification, dseq)).toBe(1);
  });

  it("warns again once the deadline moves further out", async () => {
    const { notifier, createUserWithWallet, createDeploymentSetting, extendDeadline, createNotification } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "300003";
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 24, runtimeEndsAt: hoursFromNow(3) });

    await notifier.notifyExpiringDeployments({ dryRun: false });
    await extendDeadline(user.id, dseq, hoursFromNow(5));
    await notifier.notifyExpiringDeployments({ dryRun: false });

    expect(countNotificationsFor(createNotification, dseq)).toBe(2);
  });

  it("stops warning once the limit is lifted", async () => {
    const { notifier, createUserWithWallet, createDeploymentSetting, liftLimit, createNotification } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "300004";
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 24, runtimeEndsAt: hoursFromNow(3) });

    await liftLimit(user.id, dseq);
    const result = await notifier.notifyExpiringDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(countNotificationsFor(createNotification, dseq)).toBe(0);
  });

  it("never warns about a deployment with no runtime limit", async () => {
    const { notifier, createUserWithWallet, createDeploymentSetting, createNotification } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "300005";
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: null, runtimeEndsAt: null });

    const result = await notifier.notifyExpiringDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(countNotificationsFor(createNotification, dseq)).toBe(0);
  });

  it("leaves a deadline beyond the lead window alone", async () => {
    const { notifier, createUserWithWallet, createDeploymentSetting, createNotification } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "300006";
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 24, runtimeEndsAt: hoursFromNow(20) });

    const result = await notifier.notifyExpiringDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(countNotificationsFor(createNotification, dseq)).toBe(0);
  });

  it("neither emails nor stamps on a dry run", async () => {
    const { notifier, createUserWithWallet, createDeploymentSetting, findSetting, createNotification } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "300007";
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 24, runtimeEndsAt: hoursFromNow(3) });

    const result = await notifier.notifyExpiringDeployments({ dryRun: true });

    expect(result.ok).toBe(true);
    expect(countNotificationsFor(createNotification, dseq)).toBe(0);
    expect(await findSetting(user.id, dseq)).toMatchObject({ runtimeEndingNotifiedFor: null });
  });

  it("leaves a trial wallet to its own closing warning", async () => {
    const { notifier, createUserWithWallet, createDeploymentSetting, createNotification } = await setup();
    const { user } = await createUserWithWallet({ isTrialing: true });
    const dseq = "300008";
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 24, runtimeEndsAt: hoursFromNow(3) });

    const result = await notifier.notifyExpiringDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(countNotificationsFor(createNotification, dseq)).toBe(0);
  });

  function hoursFromNow(hours: number) {
    return new Date(Date.now() + hoursToMilliseconds(hours));
  }

  /** The sweep is account-wide and the suite shares one database, so every count is scoped to one deployment. */
  function countNotificationsFor(createNotification: MockInstance<NotificationService["createNotification"]>, dseq: string) {
    return createNotification.mock.calls.filter(([notification]) => notification.payload.description.includes(`<strong>${dseq}</strong>`)).length;
  }

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const userWalletsTable = resolveTable("UserWallets");
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const userRepository = container.resolve(UserRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const notifier = container.resolve(ExpiringDeploymentsNotifierService);

    const createNotification = vi.spyOn(container.resolve(NotificationService), "createNotification").mockResolvedValue(undefined);

    async function createUserWithWallet(overrides: { isTrialing?: boolean } = {}) {
      const address = createAkashAddress();
      const user = await userRepository.create({ email: "owner@example.com" });
      const [wallet] = await db
        .insert(userWalletsTable)
        .values({
          userId: user.id,
          address,
          deploymentAllowance: "10000000",
          feeAllowance: "5000000",
          isTrialing: overrides.isTrialing ?? false
        })
        .returning();

      return { user, wallet, address };
    }

    async function createDeploymentSetting(userId: string, dseq: string, overrides: { runtimeLimitHours: number | null; runtimeEndsAt: Date | null }) {
      const [setting] = await db
        .insert(deploymentSettingsTable)
        .values({
          userId,
          dseq,
          autoTopUpEnabled: true,
          closed: false,
          runtimeLimitHours: overrides.runtimeLimitHours,
          runtimeEndsAt: overrides.runtimeEndsAt
        })
        .returning();

      return setting;
    }

    async function extendDeadline(userId: string, dseq: string, runtimeEndsAt: Date) {
      await db
        .update(deploymentSettingsTable)
        .set({ runtimeEndsAt })
        .where(and(eq(deploymentSettingsTable.userId, userId), eq(deploymentSettingsTable.dseq, dseq)));
    }

    async function liftLimit(userId: string, dseq: string) {
      await db
        .update(deploymentSettingsTable)
        .set({ runtimeLimitHours: null, runtimeEndsAt: null })
        .where(and(eq(deploymentSettingsTable.userId, userId), eq(deploymentSettingsTable.dseq, dseq)));
    }

    /**
     * Anchors the deadline the way production does, from `now()`, whose microseconds a `Date` cannot hold,
     * then pulls it into the warning window with SQL arithmetic so those digits survive.
     */
    async function startCountdown(settingId: string, pullForwardHours: number) {
      await deploymentSettingRepository.startRuntimeCountdown(settingId);
      await db
        .update(deploymentSettingsTable)
        .set({ runtimeEndsAt: sql`${deploymentSettingsTable.runtimeEndsAt} - (${pullForwardHours} * interval '1 hour')` })
        .where(eq(deploymentSettingsTable.id, settingId));
    }

    async function findSetting(userId: string, dseq: string) {
      const [setting] = await db
        .select()
        .from(deploymentSettingsTable)
        .where(and(eq(deploymentSettingsTable.userId, userId), eq(deploymentSettingsTable.dseq, dseq)));

      return setting;
    }

    return { notifier, createUserWithWallet, createDeploymentSetting, startCountdown, extendDeadline, liftLimit, findSetting, createNotification };
  }
});
