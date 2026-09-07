import { faker } from "@faker-js/faker";
import { subMinutes } from "date-fns";
import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, JobQueueService, POSTGRES_DB, resolveTable } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import {
  DeleteUnbackedDeploymentSetting,
  DeleteUnbackedDeploymentSettingHandler,
  unbackedDeploymentSettingKeyFor
} from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { UserRepository } from "@src/user/repositories";
import { ClosedDeploymentsReconcilerService } from "./closed-deployments-reconciler.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDeployment } from "@test/seeders/deployment.seeder";

type CompensationJobRow = { state: string; priority: number; data: { deploymentSettingId: string; owner: string; dseq: string } };

let jobQueueReady: Promise<JobQueueService> | undefined;

/** pg-boss owns its own schema and creates it on start, so the queue the compensations land in is bootstrapped once per file, with no worker to drain it. */
function bootstrapJobQueue() {
  jobQueueReady ??= (async () => {
    const jobQueue = container.resolve(JobQueueService);
    await jobQueue.setup();
    await jobQueue.registerHandlers([container.resolve(DeleteUnbackedDeploymentSettingHandler)]);

    return jobQueue;
  })();

  return jobQueueReady;
}

describe(ClosedDeploymentsReconcilerService.name, () => {
  afterAll(async () => {
    if (jobQueueReady) await (await jobQueueReady).dispose();
  });

  it("hands a record the indexer never saw to the compensation queue once it has outlived the grace", async () => {
    const { service, recordDeployment, findCompensation, graceInMinutes } = await setup();
    const unbacked = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: null, recordedMinutesAgo: graceInMinutes + 1 });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await findCompensation(unbacked)).toEqual([
      { state: "created", priority: -1, data: { deploymentSettingId: unbacked.id, owner: unbacked.address, dseq: unbacked.dseq } }
    ]);
  });

  it("queues one compensation for a record across two runs", async () => {
    const { service, recordDeployment, findCompensation, graceInMinutes } = await setup();
    const unbacked = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: null, recordedMinutesAgo: graceInMinutes + 1 });

    await service.reconcileClosedDeployments({ dryRun: false });
    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await findCompensation(unbacked)).toHaveLength(1);
  });

  it("leaves a record the indexer has not seen yet alone while it is within the grace", async () => {
    const { service, recordDeployment, findCompensation, readClosed } = await setup();
    const fresh = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: null });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await readClosed(fresh.id)).toBe(false);
    expect(await findCompensation(fresh)).toEqual([]);
  });

  it("queues no compensation during a dry run", async () => {
    const { service, recordDeployment, findCompensation, graceInMinutes } = await setup();
    const unbacked = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: null, recordedMinutesAgo: graceInMinutes + 1 });

    await service.reconcileClosedDeployments({ dryRun: true });

    expect(await findCompensation(unbacked)).toEqual([]);
  });

  it("marks a record closed once the chain has closed its deployment", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const settled = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: true });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await readClosed(settled.id)).toBe(true);
  });

  it("marks a record closed even when its owner turned funding off, which the funding sweep never selects", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const fundingOff = await recordDeployment({ autoTopUpEnabled: false, closedOnChain: true });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await readClosed(fundingOff.id)).toBe(true);
  });

  it("leaves a record open while its deployment is still running on chain", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const running = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: false });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await readClosed(running.id)).toBe(false);
  });

  it("marks nothing closed for a record the indexer holds no deployment for", async () => {
    const { service, recordDeployment, readClosed, graceInMinutes } = await setup();
    const unindexed = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: null, recordedMinutesAgo: graceInMinutes + 1 });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await readClosed(unindexed.id)).toBe(false);
  });

  it("matches a record whose dseq carries leading zeros the indexer does not", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const padded = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: true, padDseq: true });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await readClosed(padded.id)).toBe(true);
  });

  it("changes nothing during a dry run", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const settled = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: true });

    await service.reconcileClosedDeployments({ dryRun: true });

    expect(await readClosed(settled.id)).toBe(false);
  });

  it("converges a set larger than one batch", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const settled = await Promise.all(Array.from({ length: 5 }, () => recordDeployment({ autoTopUpEnabled: faker.datatype.boolean(), closedOnChain: true })));

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await Promise.all(settled.map(({ id }) => readClosed(id)))).toEqual([true, true, true, true, true]);
  });

  async function setup() {
    container.resolve(CHAIN_DB);
    await bootstrapJobQueue();

    const service = container.resolve(ClosedDeploymentsReconcilerService);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const userRepository = container.resolve(UserRepository);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const userWalletsTable = resolveTable("UserWallets");
    const backgroundJobsSchema = sql.identifier(container.resolve(CoreConfigService).get("POSTGRES_BACKGROUND_JOBS_SCHEMA"));
    const graceInMinutes = container.resolve(DeploymentConfigService).get("UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN");

    const user = await userRepository.create({ userId: faker.string.uuid() });
    const address = createAkashAddress();
    await db.insert(userWalletsTable).values({ userId: user.id, address, deploymentAllowance: "0", feeAllowance: "0", isTrialing: false });

    async function recordDeployment(input: { autoTopUpEnabled: boolean; closedOnChain: boolean | null; padDseq?: boolean; recordedMinutesAgo?: number }) {
      const dseq = faker.number.int({ min: 100_000, max: 9_999_999 }).toString();

      if (input.closedOnChain !== null) {
        await createDeployment({ owner: address, dseq, closedHeight: input.closedOnChain ? 5_000_000 : undefined });
      }

      const [setting] = await db
        .insert(deploymentSettingsTable)
        .values({
          userId: user.id,
          dseq: input.padDseq ? `000${dseq}` : dseq,
          autoTopUpEnabled: input.autoTopUpEnabled,
          createdAt: subMinutes(new Date(), input.recordedMinutesAgo ?? 0)
        })
        .returning({ id: deploymentSettingsTable.id, dseq: deploymentSettingsTable.dseq });

      return { ...setting, address };
    }

    async function readClosed(id: string) {
      return (await deploymentSettingRepository.findById(id))!.closed;
    }

    async function findCompensation(setting: { dseq: string }) {
      const rows = await db.execute<CompensationJobRow>(
        sql`select state, priority, data - 'version' as data from ${backgroundJobsSchema}.job
            where name = ${DeleteUnbackedDeploymentSetting[JOB_NAME]} and singleton_key = ${unbackedDeploymentSettingKeyFor({ userId: user.id, dseq: setting.dseq })}`
      );

      return rows as unknown as CompensationJobRow[];
    }

    return { service, deploymentSettingRepository, db, deploymentSettingsTable, user, address, graceInMinutes, recordDeployment, readClosed, findCompensation };
  }
});
