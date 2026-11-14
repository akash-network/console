import { faker } from "@faker-js/faker";
import { addHours } from "date-fns";
import { eq, sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { TxService } from "@src/core/services";
import { TemplateUsageEventRepository } from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import { CheckTemplateDeploymentStillRunningHandler } from "@src/template-marketplace/services/check-template-deployment-still-running/check-template-deployment-still-running.handler";
import {
  CheckTemplateDeploymentStillRunning,
  checkTemplateDeploymentStillRunningKeyFor
} from "@src/template-marketplace/services/check-template-deployment-still-running/check-template-deployment-still-running.job";
import { TemplateUsageService } from "./template-usage.service";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const CHECK_JOB = CheckTemplateDeploymentStillRunning[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(CheckTemplateDeploymentStillRunningHandler)]);

describe(TemplateUsageService.name, () => {
  describe("recordDeployed", () => {
    it("commits the caller's transaction when the insert fails inside it", async () => {
      const { service, txService, repository } = setup();
      const callersEvent = buildCallersEvent();
      const deployWithUnknownUser = await buildDefinition({ userId: faker.string.uuid() });

      await txService.transaction(async () => {
        await service.recordDeployed(deployWithUnknownUser, { isTrialing: false });
        await repository.record(callersEvent);
      });

      expect(await findEventsOf(callersEvent.deploymentSettingId)).toHaveLength(1);
      expect(await findEventsOf(deployWithUnknownUser.id)).toEqual([]);
    });

    it("keeps the deploy recorded when the caller's transaction rolls back", async () => {
      const { service, txService } = setup();
      const definition = await buildDefinition({ userId: null });
      const rollback = new Error("rolled back");

      await expect(
        txService.transaction(async () => {
          await service.recordDeployed(definition, { isTrialing: true });
          throw rollback;
        })
      ).rejects.toBe(rollback);

      expect(await findEventsOf(definition.id)).toEqual([
        expect.objectContaining({ source: "awesome_akash", templateRef: "hello-world", action: "deploy", isTrial: true })
      ]);
    });
  });

  describe("recordLeaseCreated", () => {
    it("commits the caller's transaction when the lease insert fails inside it", async () => {
      const { service, txService, repository } = setup();
      const { wallet, setting } = await seedTemplateDeployment();
      const callersEvent = buildCallersEvent();
      failInsertsOnTheCallersCursor(repository, txService);

      await txService.transaction(async () => {
        await service.recordLeaseCreated({ walletId: wallet.id, dseq: setting.dseq, leaseCreatedAt: new Date() });
        await callersCursor(txService).insert(resolveTable("TemplateUsageEvents")).values(callersEvent);
      });

      expect(await findEventsOf(callersEvent.deploymentSettingId)).toHaveLength(1);
    });

    it("keeps the lease recorded and its check scheduled when the caller's transaction rolls back", async () => {
      const { service, txService } = setup();
      await jobWorkers();
      const { wallet, setting } = await seedTemplateDeployment();
      const leaseCreatedAt = new Date();
      const rollback = new Error("rolled back");

      await expect(
        txService.transaction(async () => {
          await service.recordLeaseCreated({ walletId: wallet.id, dseq: setting.dseq, leaseCreatedAt });
          throw rollback;
        })
      ).rejects.toBe(rollback);

      expect(await findEventsOf(setting.id)).toEqual([
        expect.objectContaining({ source: "awesome_akash", templateRef: "hello-world", action: "lease_created", userId: setting.userId })
      ]);
      const checks = await findJobRows(CHECK_JOB, { singletonKey: checkTemplateDeploymentStillRunningKeyFor(setting.id) });
      expect(checks.map(({ state, data, start_after }) => ({ state, data, startAfter: new Date(start_after) }))).toEqual([
        {
          state: "created",
          data: { deploymentSettingId: setting.id, walletId: wallet.id, dseq: setting.dseq, isTrial: false, version: 1 },
          startAfter: addHours(leaseCreatedAt, 24)
        }
      ]);
    });
  });

  async function seedTemplateDeployment() {
    const { user, wallet } = await seedUserWithWallet();
    const setting = await seedDeploymentSetting({ userId: user.id, templateId: "hello-world" });

    return { wallet, setting };
  }

  function failInsertsOnTheCallersCursor(repository: TemplateUsageEventRepository, txService: TxService) {
    const record = vi.spyOn(repository, "record").mockImplementation(async () => {
      await callersCursor(txService).execute(sql`select 1 / 0`);

      return true;
    });
    onTestFinished(() => record.mockRestore());
  }

  function callersCursor(txService: TxService) {
    return txService.getPgTx() ?? container.resolve<ApiPgDatabase>(POSTGRES_DB);
  }

  async function buildDefinition(overrides: { userId: string | null }) {
    return {
      id: faker.string.uuid(),
      organizationId: (await seedOrganization()).id,
      dseq: faker.string.numeric(10),
      templateId: "hello-world",
      templateVersionId: null,
      ...overrides
    };
  }

  function buildCallersEvent() {
    return {
      source: "awesome_akash" as const,
      templateRef: "hello-world",
      action: "deploy" as const,
      deploymentSettingId: faker.string.uuid(),
      network: "mainnet"
    };
  }

  async function findEventsOf(deploymentSettingId: string) {
    const events = resolveTable("TemplateUsageEvents");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(events).where(eq(events.deploymentSettingId, deploymentSettingId));
  }

  function setup() {
    return {
      service: container.resolve(TemplateUsageService),
      txService: container.resolve(TxService),
      repository: container.resolve(TemplateUsageEventRepository)
    };
  }
});
