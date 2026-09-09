import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { RecordDeploymentSetting, RecordDeploymentSettingHandler, recordDeploymentSettingKeyFor } from "./record-deployment-setting.handler";

import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(RecordDeploymentSettingHandler)]);

describe(RecordDeploymentSettingHandler.name, () => {
  it("records a setting with auto top up on for a deployment that has none", async () => {
    const { userId, dseq, jobKey, enqueueRecord, startWorkers, findSettings } = await setup();

    await enqueueRecord();
    await startWorkers();
    await expectJobCompleted(RecordDeploymentSetting[JOB_NAME], { singletonKey: jobKey });

    const settings = await findSettings();

    expect(settings).toHaveLength(1);
    expect(settings[0]).toMatchObject({ userId, dseq, autoTopUpEnabled: true, closed: false });
  });

  it("leaves the auto top up choice a user already made alone", async () => {
    const { jobKey, enqueueRecord, startWorkers, findSettings, seedExistingSetting } = await setup();
    await seedExistingSetting({ autoTopUpEnabled: false, runtimeLimitHours: 12 });

    await enqueueRecord();
    await startWorkers();
    await expectJobCompleted(RecordDeploymentSetting[JOB_NAME], { singletonKey: jobKey });

    const settings = await findSettings();

    expect(settings).toHaveLength(1);
    expect(settings[0]).toMatchObject({ autoTopUpEnabled: false, runtimeLimitHours: 12 });
  });

  it("refuses a second record for the same deployment while the first is still queued", async () => {
    const { enqueueRecord } = await setup();

    const first = await enqueueRecord();
    const second = await enqueueRecord();

    expect(first).toEqual(expect.any(String));
    expect(second).toBeNull();
  });

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const { enqueue, startWorkers } = await jobWorkers();

    const user = await container.resolve(UserRepository).create({});
    const dseq = createDseq();

    return {
      userId: user.id,
      dseq,
      jobKey: recordDeploymentSettingKeyFor({ userId: user.id, dseq }),
      seedExistingSetting: (overrides: { autoTopUpEnabled?: boolean; runtimeLimitHours?: number }) =>
        seedDeploymentSetting({ userId: user.id, dseq, ...overrides }),
      enqueueRecord: () =>
        enqueue(new RecordDeploymentSetting({ userId: user.id, dseq }), { singletonKey: recordDeploymentSettingKeyFor({ userId: user.id, dseq }) }),
      startWorkers,
      findSettings: () => db.select().from(deploymentSettingsTable).where(eq(deploymentSettingsTable.userId, user.id))
    };
  }
});
