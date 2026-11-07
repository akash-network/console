import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { TxService } from "@src/core/services";
import { TemplateUsageEventRepository } from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import { TemplateUsageService } from "./template-usage.service";

describe(TemplateUsageService.name, () => {
  describe("recordDeployed", () => {
    it("commits the caller's transaction when the insert fails inside it", async () => {
      const { service, txService, repository } = setup();
      const callersEvent = buildCallersEvent();
      const deployWithUnknownUser = buildDefinition({ userId: faker.string.uuid() });

      await txService.transaction(async () => {
        await service.recordDeployed(deployWithUnknownUser, { isTrialing: false });
        await repository.record(callersEvent);
      });

      expect(await findEventsOf(callersEvent.deploymentSettingId)).toHaveLength(1);
      expect(await findEventsOf(deployWithUnknownUser.id)).toEqual([]);
    });

    it("keeps the deploy recorded when the caller's transaction rolls back", async () => {
      const { service, txService } = setup();
      const definition = buildDefinition({ userId: null });
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

  function buildDefinition(overrides: { userId: string | null }) {
    return {
      id: faker.string.uuid(),
      organizationId: null,
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
