import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { beforeAll, describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { CheckTemplateDeploymentStillRunningHandler } from "./check-template-deployment-still-running.handler";

import { createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe(CheckTemplateDeploymentStillRunningHandler.name, () => {
  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();
  });

  it("records a deployment still holding an active lease", async () => {
    const { handler, payload, setting } = await setup({ lease: "active" });

    await handler.handle(payload);

    expect(await findEventsOf(setting.id)).toEqual([
      expect.objectContaining({
        source: "awesome_akash",
        templateRef: "hello-world",
        action: "still_running_24h",
        userId: setting.userId,
        dseq: setting.dseq,
        isTrial: true
      })
    ]);
  });

  it("records once when the job runs twice", async () => {
    const { handler, payload, setting } = await setup({ lease: "active" });

    await handler.handle(payload);
    await handler.handle(payload);

    expect(await findEventsOf(setting.id)).toHaveLength(1);
  });

  it("records nothing for a deployment whose leases closed", async () => {
    const { handler, payload, setting } = await setup({ lease: "closed" });

    await expect(handler.handle(payload)).resolves.toBeUndefined();

    expect(await findEventsOf(setting.id)).toEqual([]);
  });

  it("records nothing for a deployment the console no longer holds a record of", async () => {
    const { handler, payload } = await setup({ lease: "active" });
    const missingSettingId = faker.string.uuid();

    await expect(handler.handle({ ...payload, deploymentSettingId: missingSettingId })).resolves.toBeUndefined();

    expect(await findEventsOf(missingSettingId)).toEqual([]);
  });

  async function findEventsOf(deploymentSettingId: string) {
    const events = resolveTable("TemplateUsageEvents");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(events).where(eq(events.deploymentSettingId, deploymentSettingId));
  }

  async function setup(input: { lease: "active" | "closed" }) {
    const { user, wallet, address } = await seedUserWithWallet({ isTrialing: true });
    const setting = await seedDeploymentSetting({ userId: user.id, templateId: "hello-world" });
    const provider = await createProvider();
    const deployment = await createDeployment({ owner: address, dseq: setting.dseq });
    const group = await createDeploymentGroup({ deploymentId: deployment.id, owner: address, dseq: setting.dseq, gseq: 1 });
    await createLease({
      deploymentId: deployment.id,
      deploymentGroupId: group.id,
      owner: address,
      dseq: setting.dseq,
      gseq: 1,
      oseq: 1,
      providerAddress: provider.owner,
      closedHeight: input.lease === "closed" ? 10_000 : undefined
    });

    return {
      handler: container.resolve(CheckTemplateDeploymentStillRunningHandler),
      payload: { deploymentSettingId: setting.id, walletId: wallet.id, dseq: setting.dseq, version: 1 as const },
      setting
    };
  }
});
