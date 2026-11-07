import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import { type TemplateUsageEventInput, TemplateUsageEventRepository } from "./template-usage-event.repository";

import { seedOrganization, seedProject } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(TemplateUsageEventRepository.name, () => {
  describe("record", () => {
    it("records one event per deployment and action however often it is recorded", async () => {
      const { repository } = setup();
      const event = buildEvent({ deploymentSettingId: faker.string.uuid() });

      const first = await repository.record(event);
      const concurrent = await Promise.all([repository.record(event), repository.record(event), repository.record(event)]);
      const otherAction = await repository.record({ ...event, action: "lease_created" });

      expect(first).toBe(true);
      expect(concurrent).toEqual([false, false, false]);
      expect(otherAction).toBe(true);
      expect((await findEventsOf(event.deploymentSettingId!)).map(({ action }) => action).sort()).toEqual(["deploy", "lease_created"]);
    });

    it("records every event that names no deployment", async () => {
      const { repository } = setup();
      const templateRef = faker.string.uuid();
      const event = buildEvent({ templateRef, action: "favorite", deploymentSettingId: null, dseq: null });

      const recorded = [await repository.record(event), await repository.record(event)];

      expect(recorded).toEqual([true, true]);
      expect(await findEventsByRef(templateRef)).toHaveLength(2);
    });

    it("stores what the event was given and defaults the rest", async () => {
      const { repository } = setup();
      const user = await seedUser();
      const organization = await seedOrganization();
      const event = buildEvent({ userId: user.id, organizationId: organization.id, deploymentSettingId: faker.string.uuid() });

      await repository.record(event);

      expect(await findEventsOf(event.deploymentSettingId!)).toEqual([{ ...event, id: expect.any(String), isTrial: false, createdAt: expect.any(Date) }]);
    });

    it("keeps events when the template is deleted", async () => {
      const { repository } = setup();
      const user = await seedUser();
      const { template, version } = await seedTemplateWithVersion();
      const event = buildEvent({ templateRef: template.id, templateVersionId: version.id, userId: user.id, deploymentSettingId: faker.string.uuid() });
      await repository.record(event);

      await deleteTemplate(template.id);

      expect(await findEventsOf(event.deploymentSettingId!)).toEqual([
        expect.objectContaining({ templateRef: template.id, templateVersionId: version.id, userId: user.id })
      ]);
    });
  });

  describe("findTemplateIdOfVersion", () => {
    it("finds the template a version belongs to", async () => {
      const { repository } = setup();
      const { template, version } = await seedTemplateWithVersion();

      expect(await repository.findTemplateIdOfVersion(version.id)).toBe(template.id);
    });

    it("finds nothing once the template is deleted", async () => {
      const { repository } = setup();
      const { template, version } = await seedTemplateWithVersion();

      await deleteTemplate(template.id);

      expect(await repository.findTemplateIdOfVersion(version.id)).toBeUndefined();
    });
  });

  function buildEvent(overrides: Partial<TemplateUsageEventInput> = {}): TemplateUsageEventInput {
    return {
      source: "console",
      templateRef: faker.string.uuid(),
      templateVersionId: faker.string.uuid(),
      action: "deploy",
      userId: null,
      organizationId: null,
      deploymentSettingId: faker.string.uuid(),
      dseq: faker.string.numeric(10),
      network: "mainnet",
      ...overrides
    };
  }

  async function seedTemplateWithVersion() {
    const organization = await seedOrganization();
    const project = await seedProject({ organizationId: organization.id, isDefault: true });
    const [template] = await db()
      .insert(resolveTable("Templates"))
      .values({
        organizationId: organization.id,
        projectId: project.id,
        title: faker.lorem.words(3),
        sdl: faker.lorem.paragraph(),
        cpu: 1000,
        ram: 1000000,
        storage: 1000000
      })
      .returning();
    const version = await container.resolve(TemplateVersionRepository).appendVersion({ templateId: template.id, sdl: "version: '2.0'" });

    return { template, version };
  }

  async function deleteTemplate(id: string) {
    const templates = resolveTable("Templates");
    await db().delete(templates).where(eq(templates.id, id));
  }

  async function findEventsOf(deploymentSettingId: string) {
    const events = resolveTable("TemplateUsageEvents");

    return await db().select().from(events).where(eq(events.deploymentSettingId, deploymentSettingId));
  }

  async function findEventsByRef(templateRef: string) {
    const events = resolveTable("TemplateUsageEvents");

    return await db().select().from(events).where(eq(events.templateRef, templateRef));
  }

  function db() {
    return container.resolve<ApiPgDatabase>(POSTGRES_DB);
  }

  function setup() {
    return { repository: container.resolve(TemplateUsageEventRepository) };
  }
});
