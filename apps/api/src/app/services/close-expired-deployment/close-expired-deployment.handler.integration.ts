import "@src/app/providers/jobs.provider";

import { addHours, minutesToMilliseconds } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { deploymentCloseDedupeKeyOf } from "@src/activity/lib/dedupe-key/dedupe-key";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CloseExpiredDeploymentCommand } from "@src/deployment/commands/close-expired-deployment.command";
import { DeploymentCloseJobService } from "@src/deployment/services/deployment-close-job/deployment-close-job.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { closedActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { CloseExpiredDeploymentHandler } from "./close-expired-deployment.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const RETRY_DELAY_IN_MS = minutesToMilliseconds(15);
const UNSETTLEABLE_ESCROW = "negative decimal coin amount";

const jobWorkers = useJobWorkers(() => [container.resolve(CloseExpiredDeploymentHandler)]);

describe(CloseExpiredDeploymentHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes a deployment whose runtime limit has passed and records it closed", async () => {
    const { dseq, closeExpired, close, findSetting } = await setup();

    await closeExpired();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ address: expect.any(String) }), dseq, { reason: "runtime_limit_reached" });
    expect((await findSetting()).closed).toBe(true);
  });

  it("closes a team deployment a member created with the organization's wallet", async () => {
    const { dseq, closeExpired, close, findSetting, teamWallet } = await setup({ inTeam: true });

    await closeExpired();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: teamWallet!.id, address: teamWallet!.address }), dseq, {
      reason: "runtime_limit_reached"
    });
    expect((await findSetting()).closed).toBe(true);
  });

  it("records the close in the owner's feed as Console's, because the runtime limit was reached", async () => {
    const { dseq, address, closeExpired, findActivities } = await setup();

    await closeExpired();

    expect(await findActivities()).toEqual([
      expect.objectContaining({
        type: "deployment_close",
        status: "succeeded",
        initiator: "system",
        meta: { dseq, reason: "runtime_limit_reached" },
        dedupeKey: deploymentCloseDedupeKeyOf({ owner: address, dseq }),
        seenAt: null
      })
    ]);
  });

  it("records a team deployment's close in the feed of the member who created it, keyed by the organization's wallet", async () => {
    const { dseq, teamWallet, closeExpired, findActivities } = await setup({ inTeam: true });

    await closeExpired();

    expect(await findActivities()).toEqual([
      expect.objectContaining({
        initiator: "system",
        meta: { dseq, reason: "runtime_limit_reached" },
        dedupeKey: deploymentCloseDedupeKeyOf({ owner: teamWallet!.address!, dseq })
      })
    ]);
  });

  it("adds nothing to the feed when the owner's own close of the deployment is already there, so the close shows once", async () => {
    const { userId, dseq, address, closeExpired, findActivities } = await setup();
    const usersClose = await container.resolve(ActivityRepository).create(closedActivityOf({ userId, owner: address, dseq }));

    await closeExpired();

    expect(await findActivities()).toEqual([usersClose]);
  });

  it("adds nothing to the feed when the deployment had already closed, but still marks the setting closed", async () => {
    const { closeExpired, close, findSetting, findActivities } = await setup();
    close.mockResolvedValue(false);

    await closeExpired();

    expect(await findActivities()).toEqual([]);
    expect((await findSetting()).closed).toBe(true);
  });

  it("still marks the setting closed when the feed entry cannot be written", async () => {
    const { closeExpired, findSetting, findActivities } = await setup();
    vi.spyOn(container.resolve(ActivityRepository), "createUnlessDuplicate").mockRejectedValue(new Error("connection terminated"));

    await closeExpired();

    expect((await findSetting()).closed).toBe(true);
    expect(await findActivities()).toEqual([]);
  });

  it("reschedules itself for a deadline that has since moved out", async () => {
    const { runtimeEndsAt, closeExpired, close, findPendingCloseJob } = await setup({ runtimeEndsAt: addHours(new Date(), 5) });

    await closeExpired();

    expect(close).not.toHaveBeenCalled();
    expect(new Date((await findPendingCloseJob()).start_after)).toEqual(runtimeEndsAt);
  });

  it("does nothing for a setting whose runtime limit was removed", async () => {
    const { closeExpired, close, findPendingCloseJob } = await setup({ runtimeEndsAt: null });

    await closeExpired();

    expect(close).not.toHaveBeenCalled();
    expect(await findPendingCloseJob()).toBeUndefined();
  });

  it("does nothing for a setting already closed", async () => {
    const { closeExpired, close, findSetting } = await setup({ closed: true });

    await closeExpired();

    expect(close).not.toHaveBeenCalled();
    expect((await findSetting()).closed).toBe(true);
  });

  it("leaves the setting open and tries again later while the dry run flag is on", async () => {
    const { closeExpired, close, findSetting, findPendingCloseJob } = await setup({ dryRun: "true" });

    await closeExpired();

    expect(close).not.toHaveBeenCalled();
    expect((await findSetting()).closed).toBe(false);
    expect(Date.parse((await findPendingCloseJob()).start_after)).toBeGreaterThan(Date.now() + RETRY_DELAY_IN_MS * 0.8);
  });

  it("leaves the setting open and tries again later when the escrow cannot be settled", async () => {
    const { closeExpired, close, findSetting, findPendingCloseJob } = await setup();
    close.mockRejectedValue(new Error(`failed to execute message: ${UNSETTLEABLE_ESCROW}`));

    await closeExpired();

    expect((await findSetting()).closed).toBe(false);
    expect(await findPendingCloseJob()).toBeDefined();
  });

  it("tries again later when the wallet has no address to close from", async () => {
    const { closeExpired, close, findSetting, findPendingCloseJob } = await setup({ address: null });

    await closeExpired();

    expect(close).not.toHaveBeenCalled();
    expect((await findSetting()).closed).toBe(false);
    expect(await findPendingCloseJob()).toBeDefined();
  });

  async function setup(input: { runtimeEndsAt?: Date | null; closed?: boolean; address?: string | null; dryRun?: "true" | "false"; inTeam?: boolean } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");

    const { user, address } = await seedUserWithWallet({ ...(input.address === null ? { address: null } : {}) });
    const teamWallet = input.inTeam ? await seedTeamWalletFor(user.id) : undefined;
    const runtimeEndsAt = input.runtimeEndsAt === undefined ? new Date(Date.now() - 60_000) : input.runtimeEndsAt;
    const setting = await seedDeploymentSetting({
      userId: user.id,
      organizationId: teamWallet?.organizationId,
      runtimeLimitHours: 1,
      runtimeEndsAt,
      closed: input.closed ?? false
    });

    const deploymentConfig = container.resolve(DeploymentConfigService);
    const readConfig = deploymentConfig.get.bind(deploymentConfig);
    vi.spyOn(deploymentConfig, "get").mockImplementation((key =>
      key === "CLOSE_EXPIRED_DEPLOYMENTS_DRY_RUN" ? input.dryRun ?? "false" : readConfig(key)) as typeof deploymentConfig.get);

    const close = vi.spyOn(container.resolve(DeploymentWriterService), "close").mockResolvedValue(true);
    const singletonKey = DeploymentCloseJobService.singletonKey(setting.id);

    return {
      userId: user.id,
      address,
      dseq: setting.dseq,
      teamWallet,
      runtimeEndsAt: runtimeEndsAt as Date,
      close,
      findActivities: () => container.resolve(ActivityRepository).find({ userId: user.id }),
      findSetting: async () => {
        const [row] = await db.select().from(deploymentSettingsTable).where(eq(deploymentSettingsTable.id, setting.id));

        return row;
      },
      findPendingCloseJob: async () => {
        const [row] = await findJobRows(CloseExpiredDeploymentCommand[JOB_NAME], { singletonKey, state: "created" });

        return row;
      },
      closeExpired: async () => {
        await enqueue(new CloseExpiredDeploymentCommand({ deploymentSettingId: setting.id, userId: user.id, dseq: setting.dseq }), { singletonKey });
        await startWorkers();
        await expectJobCompleted(CloseExpiredDeploymentCommand[JOB_NAME], { singletonKey, state: "completed" });
      }
    };
  }

  async function seedTeamWalletFor(memberId: string) {
    const { organization } = await seedOrganizationWithOwner();
    await seedOrganizationMember({ organizationId: organization.id, userId: memberId });
    const [wallet] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({ userId: null, organizationId: organization.id, address: createAkashAddress(), isTrialing: false })
      .returning();

    return wallet;
  }
});
