import { faker } from "@faker-js/faker";
import { subDays, subHours } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import { type TemplateUsageEventInput, TemplateUsageEventRepository } from "./template-usage-event.repository";

import { seedOrganization, seedProject } from "@test/seeders/db/organization.seeder";
import { seedTemplate as seedPublishedTemplate, seedTemplateDeployers, seedTemplatePublisher, seedTemplateVersion } from "@test/seeders/db/template.seeder";
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

  describe("findTemplateOfVersion", () => {
    it("finds the template a version belongs to, with the version's number and how the template is shared", async () => {
      const { repository } = setup();
      const { template, version } = await seedTemplateWithVersion();
      const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
      await db
        .update(resolveTable("TemplateVersions"))
        .set({ version: 7 })
        .where(eq(resolveTable("TemplateVersions").id, version.id));

      expect(await repository.findTemplateOfVersion(version.id)).toEqual({
        templateId: template.id,
        versionNumber: 7,
        isOfficial: false,
        visibility: template.visibility
      });

      await db
        .update(resolveTable("Templates"))
        .set({ isOfficial: true, visibility: "public" })
        .where(eq(resolveTable("Templates").id, template.id));

      expect(await repository.findTemplateOfVersion(version.id)).toEqual({ templateId: template.id, versionNumber: 7, isOfficial: true, visibility: "public" });
    });

    it("finds nothing once the template is deleted", async () => {
      const { repository } = setup();
      const { template, version } = await seedTemplateWithVersion();

      await deleteTemplate(template.id);

      expect(await repository.findTemplateOfVersion(version.id)).toBeUndefined();
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

  describe("recordForkOncePerDay", () => {
    it("counts one fork per user, template and network in any 24 hours", async () => {
      const { repository } = setup();
      const [user, otherUser, organization] = await Promise.all([seedUser(), seedUser(), seedOrganization()]);
      const [templateRef, otherTemplateRef, templateVersionId] = [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()];
      const fork = { templateRef, templateVersionId, userId: user.id, organizationId: organization.id, network: "mainnet" };

      const counted = [
        await repository.recordForkOncePerDay(fork),
        await repository.recordForkOncePerDay(fork),
        await repository.recordForkOncePerDay({ ...fork, userId: otherUser.id }),
        await repository.recordForkOncePerDay({ ...fork, templateRef: otherTemplateRef }),
        await repository.recordForkOncePerDay({ ...fork, network: "sandbox" })
      ];

      expect(counted).toEqual([true, false, true, true, true]);
      expect(await findEventsByRef(templateRef)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: "console",
            action: "fork",
            userId: user.id,
            organizationId: organization.id,
            network: "mainnet",
            templateVersionId
          })
        ])
      );
      expect(await findEventsByRef(templateRef)).toHaveLength(3);
    });

    it("counts the next fork once the last one is a day old, whatever else the user did with the template since", async () => {
      const { repository } = setup();
      const user = await seedUser();
      const templateRef = faker.string.uuid();
      const fork = { templateRef, templateVersionId: null, userId: user.id, organizationId: null, network: "mainnet" };
      await seedEvents([
        { templateRef, action: "fork", userId: user.id, createdAt: subHours(new Date(), 25) },
        { templateRef, action: "deploy", userId: user.id, createdAt: new Date() },
        { templateRef, action: "fork", userId: user.id, source: "awesome_akash", createdAt: new Date() }
      ]);

      const counted = [await repository.recordForkOncePerDay(fork), await repository.recordForkOncePerDay(fork)];

      expect(counted).toEqual([true, false]);
    });
  });

  describe("summarize", () => {
    it("summarizes mainnet deploys and forks only", async () => {
      const { repository } = setup();
      const [{ id: template }, { id: quiet }, { id: other }] = await Promise.all([seedTemplate(), seedTemplate(), seedTemplate()]);
      const lastDeployedAt = subHours(new Date(), 1);
      await seedEvents([
        { templateRef: template, action: "deploy", createdAt: subHours(new Date(), 30) },
        { templateRef: template, action: "deploy", createdAt: lastDeployedAt },
        { templateRef: template, action: "deploy", network: "sandbox", createdAt: new Date() },
        { templateRef: template, action: "deploy", network: "testnet", createdAt: new Date() },
        { templateRef: template, action: "deploy", source: "awesome_akash", createdAt: new Date() },
        { templateRef: template, action: "lease_created", createdAt: new Date() },
        { templateRef: template, action: "fork", createdAt: new Date() },
        { templateRef: template, action: "fork", createdAt: new Date() },
        { templateRef: template, action: "fork", network: "sandbox", createdAt: new Date() },
        { templateRef: template, action: "favorite", createdAt: new Date() },
        { templateRef: other, action: "deploy", createdAt: new Date() }
      ]);

      const summaries = await repository.summarize([template, quiet]);

      expect(summaries).toEqual(
        new Map([
          [template, { deploys: 2, lastDeployedAt, stillUpAfter24h: null, forks: 2 }],
          [quiet, { deploys: 0, lastDeployedAt: null, stillUpAfter24h: null, forks: 0 }]
        ])
      );
    });

    it("leaves a public template's own organization out of its numbers, and counts it for a template only that organization can use", async () => {
      const { repository } = setup();
      const [publisher, stranger] = await Promise.all([seedOrganization(), seedOrganization()]);
      const [published, kept] = await Promise.all([
        seedPublishedTemplate({ organizationId: publisher.id, visibility: "public" }),
        seedPublishedTemplate({ organizationId: publisher.id, visibility: "organization" })
      ]);
      const dayOld = subHours(new Date(), 25);
      const eventsOf = (templateRef: string) => [
        ...times(5, () => ({ templateRef, action: "lease_created" as const, organizationId: stranger.id, createdAt: dayOld })),
        ...times(4, () => ({ templateRef, action: "still_running_24h" as const, organizationId: stranger.id })),
        ...times(5, () => ({ templateRef, action: "lease_created" as const, organizationId: publisher.id, createdAt: dayOld })),
        ...times(5, () => ({ templateRef, action: "still_running_24h" as const, organizationId: publisher.id })),
        ...times(3, () => ({ templateRef, action: "deploy" as const, organizationId: publisher.id })),
        { templateRef, action: "deploy" as const, organizationId: stranger.id },
        { templateRef, action: "deploy" as const, organizationId: null },
        { templateRef, action: "fork" as const, organizationId: publisher.id },
        { templateRef, action: "fork" as const, organizationId: stranger.id }
      ];
      await seedEvents([...eventsOf(published.id), ...eventsOf(kept.id)]);

      const summaries = await repository.summarize([published.id, kept.id]);

      expect(summaries.get(published.id)).toMatchObject({ deploys: 2, stillUpAfter24h: 0.8, forks: 1 });
      expect(summaries.get(kept.id)).toMatchObject({ deploys: 5, stillUpAfter24h: 0.9, forks: 2 });
    });

    it("reports no still-up share below five day-old leases", async () => {
      const { repository } = setup();
      const { id: template } = await seedTemplate();
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

    it("summarizes no template as an empty map", async () => {
      const { repository } = setup();

      expect(await repository.summarize([])).toEqual(new Map());
    });
  });

  describe("summarizeAwesomeAkash", () => {
    it("summarizes the mainnet events of awesome-akash templates by the id their deployments named", async () => {
      const { repository } = setup();
      const [busy, quiet] = [`awesome-${faker.string.alphanumeric(12)}`, `awesome-${faker.string.alphanumeric(12)}`];
      const lastDeployedAt = subHours(new Date(), 2);
      const dayOld = subHours(new Date(), 25);
      await seedEvents(
        [
          ...times(3, () => ({ templateRef: busy, action: "deploy" as const, createdAt: subDays(new Date(), 3) })),
          { templateRef: busy, action: "deploy" as const, createdAt: lastDeployedAt },
          { templateRef: busy, action: "deploy" as const, network: "sandbox" },
          ...times(5, () => ({ templateRef: busy, action: "lease_created" as const, createdAt: dayOld })),
          ...times(2, () => ({ templateRef: busy, action: "still_running_24h" as const })),
          { templateRef: quiet, action: "favorite" as const }
        ].map(event => ({ source: "awesome_akash" as const, ...event }))
      );
      await seedEvents([{ templateRef: busy, action: "deploy", source: "console" }]);

      const summaries = await repository.summarizeAwesomeAkash(100_000);

      expect(summaries.get(busy)).toEqual({ deploys: 4, lastDeployedAt, stillUpAfter24h: 0.4, forks: 0 });
      expect(summaries.has(quiet)).toBe(false);
    });

    it("answers only ids shaped like the gallery's, the most deployed first, up to the limit", async () => {
      const { repository } = setup();
      const suffix = faker.string.alphanumeric(12);
      const [most, second, least] = [`a-most.${suffix}`, `B_second-${suffix}`, `0least-${suffix}`];
      const oddIds = [`<script>${suffix}`, `-leading-${suffix}`, `with space ${suffix}`, `__proto__${suffix}`, `trailing-${suffix}\n`];
      await seedEvents(
        [...times(9, () => most), ...times(8, () => second), ...times(7, () => least), ...oddIds.flatMap(id => times(10, () => id))].map(templateRef => ({
          templateRef,
          action: "deploy" as const,
          source: "awesome_akash" as const
        }))
      );

      const [all, top] = await Promise.all([repository.summarizeAwesomeAkash(100_000), repository.summarizeAwesomeAkash(2)]);

      expect([...all.keys()].filter(id => id.includes(suffix))).toEqual([most, second, least]);
      expect([...top.keys()]).toEqual([most, second]);
    });
  });

  describe("countDeploysByVersion", () => {
    it("counts the template's mainnet deploys per version", async () => {
      const { repository } = setup();
      const { id: template } = await seedPublishedTemplate();
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

    it("leaves a public template's own organization out of each version, and counts it for a template only that organization can use", async () => {
      const { repository } = setup();
      const [publisher, stranger] = await Promise.all([seedOrganization(), seedOrganization()]);
      const [published, kept] = await Promise.all([
        seedPublishedTemplate({ organizationId: publisher.id, visibility: "public" }),
        seedPublishedTemplate({ organizationId: publisher.id, visibility: "organization" })
      ]);
      const [first, second] = [faker.string.uuid(), faker.string.uuid()];
      const eventsOf = (templateRef: string) => [
        ...times(2, () => ({ templateRef, templateVersionId: first, action: "deploy" as const, organizationId: publisher.id })),
        { templateRef, templateVersionId: first, action: "deploy" as const, organizationId: stranger.id },
        { templateRef, templateVersionId: second, action: "deploy" as const, organizationId: null }
      ];
      await seedEvents([...eventsOf(published.id), ...eventsOf(kept.id)]);

      expect(await repository.countDeploysByVersion(published.id)).toEqual(
        new Map([
          [first, 1],
          [second, 1]
        ])
      );
      expect(await repository.countDeploysByVersion(kept.id)).toEqual(
        new Map([
          [first, 3],
          [second, 1]
        ])
      );
    });

    it("counts nothing for a template that is gone", async () => {
      const { repository } = setup();
      const template = faker.string.uuid();
      await seedEvents([{ templateRef: template, templateVersionId: faker.string.uuid(), action: "deploy" }]);

      expect(await repository.countDeploysByVersion(template)).toEqual(new Map());
    });
  });

  describe("countWeeklyDeployers", () => {
    it("counts each person who deployed the template on mainnet in the last week once, from outside the publishing organization", async () => {
      const { repository } = setup();
      const template = await seedPublishedTemplate({ visibility: "public" });
      const [repeatDeployer, member] = await Promise.all([seedUser(), seedUser()]);
      const otherOrganization = await seedOrganization();
      await seedTemplateDeployers(template.id, 3);
      await seedTemplateDeployers(template.id, 2, { organizationId: otherOrganization.id });
      await seedEvents([
        { templateRef: template.id, userId: repeatDeployer.id },
        { templateRef: template.id, userId: repeatDeployer.id },
        { templateRef: template.id, userId: member.id, organizationId: template.organizationId }
      ]);

      expect(await repository.countWeeklyDeployers(template.id, template.organizationId)).toBe(6);
    });

    it("leaves out other networks, other sources, other actions, other templates, deploys older than a week and deploys by nobody known", async () => {
      const { repository } = setup();
      const template = await seedPublishedTemplate({ visibility: "public" });
      const other = await seedPublishedTemplate({ visibility: "public" });
      await seedTemplateDeployers(template.id, 1);
      await seedTemplateDeployers(template.id, 1, { network: "sandbox" });
      await seedTemplateDeployers(template.id, 1, { source: "awesome_akash" });
      await seedTemplateDeployers(template.id, 1, { action: "lease_created" });
      await seedTemplateDeployers(template.id, 1, { action: "fork", deploymentSettingId: null });
      await seedTemplateDeployers(template.id, 1, { createdAt: subDays(new Date(), 8) });
      await seedTemplateDeployers(other.id, 4);
      await seedEvents([{ templateRef: template.id, userId: null }]);

      expect(await repository.countWeeklyDeployers(template.id, template.organizationId)).toBe(1);
    });

    it("counts a deploy made just inside the week and none for a template nobody deployed", async () => {
      const { repository } = setup();
      const template = await seedPublishedTemplate({ visibility: "public" });
      const undeployed = await seedPublishedTemplate({ visibility: "public" });
      await seedTemplateDeployers(template.id, 1, { createdAt: subHours(new Date(), 7 * 24 - 1) });

      expect(await repository.countWeeklyDeployers(template.id, template.organizationId)).toBe(1);
      expect(await repository.countWeeklyDeployers(undeployed.id, undeployed.organizationId)).toBe(0);
    });
  });

  describe("findWatchedTemplates", () => {
    it("lists the current versions of public templates with enough weekly deployers outside their organization, most deployed first", async () => {
      const { repository } = setup();
      const popular = await seedWatchable(4);
      const mostPopular = await seedWatchable(6);
      const justPopular = await seedWatchable(3);
      const tooQuiet = await seedWatchable(2);
      const selfDeployed = await seedWatchable(2);
      await seedTemplateDeployers(selfDeployed.template.id, 5, { organizationId: selfDeployed.template.organizationId });
      const oldFame = await seedWatchable(0);
      await seedTemplateDeployers(oldFame.template.id, 5, { createdAt: subDays(new Date(), 8) });
      const sandboxFame = await seedWatchable(0);
      await seedTemplateDeployers(sandboxFame.template.id, 5, { network: "sandbox" });

      const watched = await findWatchedAmong(repository, [popular, mostPopular, justPopular, tooQuiet, selfDeployed, oldFame, sandboxFame], 3);

      expect(watched).toEqual([
        { templateId: mostPopular.template.id, currentVersionId: mostPopular.version.id },
        { templateId: popular.template.id, currentVersionId: popular.version.id },
        { templateId: justPopular.template.id, currentVersionId: justPopular.version.id }
      ]);
    });

    it("lists an Official template however few people deploy it", async () => {
      const { repository } = setup();
      const official = await seedWatchable(0, { isOfficial: true });
      const community = await seedWatchable(0);

      expect(await findWatchedAmong(repository, [official, community], 3)).toEqual([
        { templateId: official.template.id, currentVersionId: official.version.id }
      ]);
    });

    it.each([
      { name: "hidden", template: { moderationStatus: "hidden" as const } },
      { name: "removed", template: { moderationStatus: "removed" as const } },
      { name: "private", template: { visibility: "private" as const } },
      { name: "shared with its organization only", template: { visibility: "organization" as const } }
    ])("skips a popular template that is $name", async ({ template }) => {
      const { repository } = setup();
      const skipped = await seedWatchable(5, { isOfficial: true, ...template });

      expect(await findWatchedAmong(repository, [skipped], 3)).toEqual([]);
    });

    it("skips a popular template of a suspended publisher and one that has no current version", async () => {
      const { repository } = setup();
      const suspended = await seedWatchable(5);
      await seedTemplatePublisher({ organizationId: suspended.template.organizationId, publishingSuspendedAt: new Date() });
      const versionless = await seedPublishedTemplate({ visibility: "public" });
      await seedTemplateDeployers(versionless.id, 5);

      expect(await findWatchedAmong(repository, [suspended, { template: versionless }], 3)).toEqual([]);
    });

    it("stops at the limit, keeping the most deployed", async () => {
      const { repository } = setup();
      const threshold = 1000;
      const first = await seedWatchable(0, { isOfficial: true });
      await seedWatchable(0, { isOfficial: true });
      await seedTemplateDeployers(first.template.id, 2);

      const watched = await repository.findWatchedTemplates({ minWeeklyDeployers: threshold, limit: 1 });

      expect(watched).toEqual([{ templateId: first.template.id, currentVersionId: first.version.id }]);
    });
  });

  async function seedWatchable(deployers: number, overrides: Parameters<typeof seedPublishedTemplate>[0] = {}) {
    const template = await seedPublishedTemplate({ visibility: "public", ...overrides });
    const version = await seedTemplateVersion({ templateId: template.id });
    await seedTemplateDeployers(template.id, deployers);

    return { template, version };
  }

  async function findWatchedAmong(repository: TemplateUsageEventRepository, seeded: { template: { id: string } }[], minWeeklyDeployers: number) {
    const ids = seeded.map(({ template }) => template.id);
    const watched = await repository.findWatchedTemplates({ minWeeklyDeployers, limit: 10_000 });

    return watched.filter(({ templateId }) => ids.includes(templateId));
  }

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
