import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type LandedTx, TxPresenceService } from "@src/chain/services/tx-presence/tx-presence.service";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { UserRepository } from "@src/user/repositories";
import { ReconcileManagedTx, ReconcileManagedTxHandler } from "./reconcile-managed-tx.handler";
import { ReconcileManagedTxJobService } from "./reconcile-managed-tx-job.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { expectJobCompleted, makeJobDue, useJobWorkers } from "@test/services/job-queue-harness";

const FUNDING_COOLDOWN_IN_MINUTES = 30;

const jobWorkers = useJobWorkers(() => [container.resolve(ReconcileManagedTxHandler)]);

describe(ReconcileManagedTxHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("releases the funding claims a reverted transaction left held", async () => {
    const { answerChainWith, reconcile, findLastFundedAt } = await setup();
    answerChainWith({ code: 11, rawLog: "insufficient funds" });

    await reconcile();

    expect(await findLastFundedAt()).toBeNull();
  });

  it("keeps the funding claims a landed transaction earned", async () => {
    const { answerChainWith, reconcile, findLastFundedAt, heldSince } = await setup();
    answerChainWith({ code: 0 });

    await reconcile();

    expect(await findLastFundedAt()).toEqual(heldSince);
  });

  it("keeps the funding claims while the transaction is not seen", async () => {
    const { answerChainAbsent, reconcile, findLastFundedAt, heldSince } = await setup();
    answerChainAbsent();

    await reconcile();

    expect(await findLastFundedAt()).toEqual(heldSince);
  });

  it("keeps a claim another pass has since re-taken", async () => {
    const { answerChainWith, reconcile, findLastFundedAt, reclaimAt } = await setup();
    answerChainWith({ code: 11, rawLog: "insufficient funds" });
    const retakenAt = await reclaimAt();

    await reconcile();

    expect(await findLastFundedAt()).toEqual(retakenAt);
  });

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const { startWorkers } = await jobWorkers();

    const txHash = faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase();
    const owner = createAkashAddress();
    const user = await container.resolve(UserRepository).create({});
    const setting = await seedDeploymentSetting({ userId: user.id });
    const [claim] = await deploymentSettingRepository.claimForFunding([setting.id], FUNDING_COOLDOWN_IN_MINUTES);
    const findTx = vi.spyOn(container.resolve(TxPresenceService), "findTx");

    async function findLastFundedAt() {
      const [row] = await db.select().from(deploymentSettingsTable).where(eq(deploymentSettingsTable.id, setting.id));

      return row.lastFundedAt;
    }

    async function reclaimAt() {
      const retakenAt = new Date(Date.now() - 1000);
      await db.update(deploymentSettingsTable).set({ lastFundedAt: retakenAt }).where(eq(deploymentSettingsTable.id, setting.id));

      return retakenAt;
    }

    const singletonKey = ReconcileManagedTxJobService.singletonKey(txHash);

    return {
      heldSince: await findLastFundedAt(),
      reclaimAt,
      findLastFundedAt,
      answerChainWith: (tx: Partial<LandedTx>) => findTx.mockResolvedValue({ hash: txHash, code: 0, height: 1, rawLog: "", ...tx }),
      answerChainAbsent: () => findTx.mockResolvedValue(null),
      reconcile: async () => {
        await container.resolve(ReconcileManagedTxJobService).schedule({ txHash, owner, claims: [claim] });
        await makeJobDue(ReconcileManagedTx[JOB_NAME], { singletonKey });
        await startWorkers();
        await expectJobCompleted(ReconcileManagedTx[JOB_NAME], { singletonKey });
      }
    };
  }
});
