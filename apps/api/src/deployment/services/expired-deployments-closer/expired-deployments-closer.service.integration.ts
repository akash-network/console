import { hoursToMilliseconds } from "date-fns";
import { and, eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { UserRepository } from "@src/user/repositories";
import { ExpiredDeploymentsCloserService } from "./expired-deployments-closer.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

/**
 * Covers which rows the sweep picks up, which is pure SQL: the deadline comparison against `now()`,
 * the `closed` guard, and the deliberate absence of an `autoTopUpEnabled` filter. Broadcasting is
 * stubbed at the writer boundary since closing on chain has its own tests.
 */
describe(ExpiredDeploymentsCloserService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes a deployment whose deadline has passed and marks the setting closed", async () => {
    const { closer, createUserWithWallet, createDeploymentSetting, findSetting, close } = await setup();
    const { user, address } = await createUserWithWallet();
    const dseq = "200001";
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 12, runtimeEndsAt: hoursAgo(1) });

    const result = await closer.closeExpiredDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ address }), dseq);
    expect(await findSetting(user.id, dseq)).toMatchObject({ closed: true });
  });

  it("leaves a deployment whose deadline is still ahead untouched", async () => {
    const { closer, createUserWithWallet, createDeploymentSetting, findSetting, close } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "200002";
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 12, runtimeEndsAt: hoursFromNow(1) });

    const result = await closer.closeExpiredDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(await findSetting(user.id, dseq)).toMatchObject({ closed: false });
  });

  it("ignores an unanchored runtime limit", async () => {
    const { closer, createUserWithWallet, createDeploymentSetting, close } = await setup();
    const { user } = await createUserWithWallet();
    await createDeploymentSetting(user.id, "200003", { runtimeLimitHours: 12, runtimeEndsAt: null });

    const result = await closer.closeExpiredDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(close).not.toHaveBeenCalled();
  });

  it("ignores a deployment already marked closed", async () => {
    const { closer, createUserWithWallet, createDeploymentSetting, close } = await setup();
    const { user } = await createUserWithWallet();
    await createDeploymentSetting(user.id, "200004", { runtimeLimitHours: 12, runtimeEndsAt: hoursAgo(5), closed: true });

    const result = await closer.closeExpiredDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(close).not.toHaveBeenCalled();
  });

  it("closes an expired deployment whose auto top-up was turned off", async () => {
    const { closer, createUserWithWallet, createDeploymentSetting, findSetting } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "200005";
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 12, runtimeEndsAt: hoursAgo(1), autoTopUpEnabled: false });

    const result = await closer.closeExpiredDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(await findSetting(user.id, dseq)).toMatchObject({ closed: true });
  });

  it("reports what it would close without broadcasting on a dry run", async () => {
    const { closer, createUserWithWallet, createDeploymentSetting, findSetting, close } = await setup();
    const { user } = await createUserWithWallet();
    const dseq = "200006";
    await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 12, runtimeEndsAt: hoursAgo(1) });

    const result = await closer.closeExpiredDeployments({ dryRun: true });

    expect(result.ok).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(await findSetting(user.id, dseq)).toMatchObject({ closed: false });
  });

  function hoursAgo(hours: number) {
    return new Date(Date.now() - hoursToMilliseconds(hours));
  }

  function hoursFromNow(hours: number) {
    return new Date(Date.now() + hoursToMilliseconds(hours));
  }

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const userWalletsTable = resolveTable("UserWallets");
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const userRepository = container.resolve(UserRepository);
    const closer = container.resolve(ExpiredDeploymentsCloserService);

    const close = vi.spyOn(container.resolve(DeploymentWriterService), "close").mockResolvedValue(undefined);

    async function createUserWithWallet() {
      const address = createAkashAddress();
      const user = await userRepository.create({});
      const [wallet] = await db
        .insert(userWalletsTable)
        .values({ userId: user.id, address, deploymentAllowance: "10000000", feeAllowance: "5000000", isTrialing: false })
        .returning();

      return { user, wallet, address };
    }

    async function createDeploymentSetting(
      userId: string,
      dseq: string,
      overrides: { autoTopUpEnabled?: boolean; closed?: boolean; runtimeLimitHours?: number; runtimeEndsAt?: Date | null }
    ) {
      const [setting] = await db
        .insert(deploymentSettingsTable)
        .values({
          userId,
          dseq,
          autoTopUpEnabled: overrides.autoTopUpEnabled ?? true,
          closed: overrides.closed ?? false,
          runtimeLimitHours: overrides.runtimeLimitHours ?? null,
          runtimeEndsAt: overrides.runtimeEndsAt ?? null
        })
        .returning();

      return setting;
    }

    async function findSetting(userId: string, dseq: string) {
      const [setting] = await db
        .select()
        .from(deploymentSettingsTable)
        .where(and(eq(deploymentSettingsTable.userId, userId), eq(deploymentSettingsTable.dseq, dseq)));

      return setting;
    }

    return { closer, createUserWithWallet, createDeploymentSetting, findSetting, close };
  }
});
