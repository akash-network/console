import { faker } from "@faker-js/faker";
import { subHours } from "date-fns";
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

    it("records every fork, which names no deployment", async () => {
      const { repository } = setup();
      const user = await seedUser();
      const templateRef = faker.string.uuid();
      const event = buildEvent({ templateRef, action: "fork", userId: user.id, deploymentSettingId: null, dseq: null });

      const recorded = [await repository.record(event), await repository.record(event)];

      expect(recorded).toEqual([true, true]);
      expect(await findEventsByRef(templateRef)).toHaveLength(2);
    });

    it("records every favorite and unfavorite of a user who changes their mind", async () => {
      const { repository } = setup();
      const user = await seedUser();
      const templateRef = faker.string.uuid();
      const favorite = buildEvent({ templateRef, action: "favorite", userId: user.id, deploymentSettingId: null, dseq: null });

      const recorded = [await repository.record(favorite), await repository.record({ ...favorite, action: "unfavorite" }), await repository.record(favorite)];

      expect(recorded).toEqual([true, true, true]);
      expect((await findEventsByRef(templateRef)).map(({ action }) => action).sort()).toEqual(["favorite", "favorite", "unfavorite"]);
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

  describe("findCurrentVersionIdOfTemplate", () => {
    it("finds the template's current version, and nothing for a template without one", async () => {
      const { repository } = setup();
      const { template, version } = await seedTemplateWithVersion();
      const versionless = await seedTemplate();

      expect(await repository.findCurrentVersionIdOfTemplate(template.id)).toBe(version.id);
      expect(await repository.findCurrentVersionIdOfTemplate(versionless.id)).toBeNull();
      expect(await repository.findCurrentVersionIdOfTemplate(faker.string.uuid())).toBeNull();
    });
  });

  describe("summarize", () => {
    it("summarizes mainnet deploys only", async () => {
      const { repository } = setup();
      const [template, quiet] = [faker.string.uuid(), faker.string.uuid()];
      const lastDeployedAt = subHours(new Date(), 1);
      await seedEvents([
        { templateRef: template, action: "deploy", createdAt: subHours(new Date(), 30) },
        { templateRef: template, action: "deploy", createdAt: lastDeployedAt },
        { templateRef: template, action: "deploy", network: "sandbox", createdAt: new Date() },
        { templateRef: template, action: "deploy", network: "testnet", createdAt: new Date() },
        { templateRef: template, action: "deploy", source: "awesome_akash", createdAt: new Date() },
        { templateRef: template, action: "lease_created", createdAt: new Date() },
        { templateRef: faker.string.uuid(), action: "deploy", createdAt: new Date() }
      ]);

      const summaries = await repository.summarize([template, quiet]);

      expect(summaries).toEqual(
        new Map([
          [template, { deploys: 2, lastDeployedAt, stillUpAfter24h: null }],
          [quiet, { deploys: 0, lastDeployedAt: null, stillUpAfter24h: null }]
        ])
      );
    });

    it("reports no still-up share below five day-old leases", async () => {
      const { repository } = setup();
      const template = faker.string.uuid();
      const dayOld = subHours(new Date(), 25);
      await seedEvents([
        ...times(4, () => ({ templateRef: template, action: "lease_created" as const, createdAt: dayOld })),
        ...times(3, () => ({ templateRef: template, action: "still_running_24h" as const, createdAt: new Date() })),
        ...times(3, () => ({ templateRef: template, action: "lease_created" as const, createdAt: subHours(new Date(), 23) })),
        ...times(2, () => ({ templateRef: template, action: "lease_created" as const, network: "sandbox", createdAt: dayOld }))
      ]);

      const belowThreshold = await repository.summarize([template]);
      await seedEvents([{ templateRef: template, action: "lease_created", createdAt: dayOld }]);
      const atThreshold = await repository.summarize([template]);

      expect(belowThreshold.get(template)?.stillUpAfter24h).toBeNull();
      expect(atThreshold.get(template)?.stillUpAfter24h).toBe(0.6);
    });

    it("never reports more than every day-old lease still up", async () => {
      const { repository } = setup();
      const template = faker.string.uuid();
      await seedEvents([
        ...times(5, () => ({ templateRef: template, action: "lease_created" as const, createdAt: subHours(new Date(), 25) })),
        ...times(6, () => ({ templateRef: template, action: "still_running_24h" as const, createdAt: new Date() }))
      ]);

      const summaries = await repository.summarize([template]);

      expect(summaries.get(template)?.stillUpAfter24h).toBe(1);
    });

    it("summarizes no template as an empty map", async () => {
      const { repository } = setup();

      expect(await repository.summarize([])).toEqual(new Map());
    });
  });

  describe("countDeploysByVersion", () => {
    it("counts the template's mainnet deploys per version", async () => {
      const { repository } = setup();
      const template = faker.string.uuid();
      const [first, second, unused] = [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()];
      await seedEvents([
        { templateRef: template, templateVersionId: first, action: "deploy" },
        { templateRef: template, templateVersionId: second, action: "deploy" },
        { templateRef: template, templateVersionId: second, action: "deploy" },
        { templateRef: template, templateVersionId: second, action: "deploy", network: "sandbox" },
        { templateRef: template, templateVersionId: second, action: "lease_created" },
        { templateRef: template, templateVersionId: second, action: "deploy", source: "awesome_akash" },
        { templateRef: faker.string.uuid(), templateVersionId: unused, action: "deploy" }
      ]);

      const counts = await repository.countDeploysByVersion(template);

      expect(counts).toEqual(
        new Map([
          [first, 1],
          [second, 2]
        ])
      );
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

  async function seedEvents(events: (Partial<TemplateUsageEventInput> & { createdAt?: Date })[]) {
    await db()
      .insert(resolveTable("TemplateUsageEvents"))
      .values(events.map(event => ({ ...buildEvent({ templateVersionId: null }), ...event })));
  }

  function times<T>(count: number, build: () => T): T[] {
    return Array.from({ length: count }, build);
  }

  async function seedTemplateWithVersion() {
    const template = await seedTemplate();
    const version = await container.resolve(TemplateVersionRepository).appendVersion({ templateId: template.id, sdl: "version: '2.0'" });

    return { template, version };
  }

  async function seedTemplate() {
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

    return template;
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
