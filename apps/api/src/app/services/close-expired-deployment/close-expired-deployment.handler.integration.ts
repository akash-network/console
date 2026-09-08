import "@src/app/providers/jobs.provider";

import { addHours, minutesToMilliseconds } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CloseExpiredDeploymentCommand } from "@src/deployment/commands/close-expired-deployment.command";
import { DeploymentCloseJobService } from "@src/deployment/services/deployment-close-job/deployment-close-job.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { CloseExpiredDeploymentHandler } from "./close-expired-deployment.handler";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
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

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ address: expect.any(String) }), dseq);
    expect((await findSetting()).closed).toBe(true);
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

  async function setup(input: { runtimeEndsAt?: Date | null; closed?: boolean; address?: string | null; dryRun?: "true" | "false" } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");

    const { user } = await seedUserWithWallet({ ...(input.address === null ? { address: null } : {}) });
    const runtimeEndsAt = input.runtimeEndsAt === undefined ? new Date(Date.now() - 60_000) : input.runtimeEndsAt;
    const setting = await seedDeploymentSetting({
      userId: user.id,
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
      dseq: setting.dseq,
      runtimeEndsAt: runtimeEndsAt as Date,
      close,
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
});
