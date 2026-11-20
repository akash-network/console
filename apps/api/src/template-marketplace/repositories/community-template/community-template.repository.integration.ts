import { faker } from "@faker-js/faker";
import { subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, type ApiPgTables, POSTGRES_DB, resolveTable } from "@src/core";
import { CommunityTemplateRepository } from "./community-template.repository";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedTemplate, seedTemplateDeployers, seedTemplatePublisher, seedTemplateScore, seedTemplateVersion } from "@test/seeders/db/template.seeder";

type TemplateInsert = ApiPgTables["Templates"]["$inferInsert"];
type TemplateVersionInsert = ApiPgTables["TemplateVersions"]["$inferInsert"];

const RESOURCES = { cpu: 0.5, memoryBytes: 536_870_912, storageBytes: 1_073_741_824 };

describe(CommunityTemplateRepository.name, () => {
  describe("list", () => {
    it("describes a listed template with its publisher, the resources of its current version and how many versions went live", async () => {
      const { repository, publisher, organization } = await setup({ publisher: { isVerified: true } });
      const publishedAt = subDays(new Date(), 2);
      const template = await seedTemplate({
        ...listed(organization.id),
        publishedAt,
        summary: "Serves a page",
        icon: "globe",
        categories: ["Web"],
        isOfficial: true,
        isFeatured: true
      });
      await seedTemplateVersion({ templateId: template.id, version: 1, isCurrent: false });
      await seedTemplateVersion({ templateId: template.id, version: 2, resources: RESOURCES });
      await seedTemplateVersion({ templateId: template.id, version: 3, status: "failed_checks", isCurrent: false });
      await seedTemplateVersion({ templateId: template.id, version: 4, status: "rejected", isCurrent: false });
      const stored = await findStoredTemplate(template.id);

      const rows = await repository.list({ organizationId: organization.id, limit: 10 });

      expect(rows).toEqual([
        {
          id: template.id,
          title: template.title,
          summary: "Serves a page",
          icon: "globe",
          categories: ["Web"],
          isOfficial: true,
          isFeatured: true,
          publishedAt,
          updatedAt: stored.updatedAt,
          publisher: { name: organization.name, handle: publisher.handle, isVerified: true },
          resources: RESOURCES,
          sdlWithoutResources: null,
          versionCount: 2,
          score: null
        }
      ]);
    });

    it("carries the score stored for the Console template, and none for a template never scored or scored under another source", async () => {
      const { repository, organization } = await setup();
      const [scored, unscored, namesake] = await Promise.all([
        seedTemplate({ ...listed(organization.id), publishedAt: subDays(new Date(), 1) }),
        seedTemplate({ ...listed(organization.id), publishedAt: subDays(new Date(), 2) }),
        seedTemplate({ ...listed(organization.id), publishedAt: subDays(new Date(), 3) })
      ]);
      await Promise.all([scored, unscored, namesake].map(template => seedTemplateVersion({ templateId: template.id })));
      await seedTemplateScore({ templateRef: scored.id, popularScore: 0, trendingScore: -0.4, isTrending: false });
      await seedTemplateScore({ templateRef: namesake.id, source: "awesome_akash", popularScore: 50, trendingScore: 3, isTrending: true });

      const rows = await repository.list({ organizationId: organization.id, limit: 10 });

      expect(rows.map(({ id, score }) => ({ id, score }))).toEqual([
        { id: scored.id, score: { popularScore: 0, trendingScore: -0.4, isTrending: false } },
        { id: unscored.id, score: null },
        { id: namesake.id, score: null }
      ]);
    });

    it("keeps the most popular templates past the limit, then the newest of the unscored, and still reads newest first", async () => {
      const { repository, organization } = await setup();
      const [oldFavorite, olderRunnerUp, newUnscored, newerUnscored, newestBarelyUsed] = await Promise.all(
        [9, 8, 3, 2, 1].map(daysAgo => seedTemplate({ ...listed(organization.id), publishedAt: subDays(new Date(), daysAgo) }))
      );
      await Promise.all(
        [oldFavorite, olderRunnerUp, newUnscored, newerUnscored, newestBarelyUsed].map(template => seedTemplateVersion({ templateId: template.id }))
      );
      await seedTemplateScore({ templateRef: oldFavorite.id, popularScore: 40 });
      await seedTemplateScore({ templateRef: olderRunnerUp.id, popularScore: 12 });
      await seedTemplateScore({ templateRef: newestBarelyUsed.id, popularScore: 0.5 });

      const twoKept = await repository.list({ organizationId: organization.id, limit: 2 });
      const fourKept = await repository.list({ organizationId: organization.id, limit: 4 });

      expect(twoKept.map(row => row.id)).toEqual([olderRunnerUp.id, oldFavorite.id]);
      expect(fourKept.map(row => row.id)).toEqual([newestBarelyUsed.id, newerUnscored.id, olderRunnerUp.id, oldFavorite.id]);
    });

    it("orders templates published at the same moment by id", async () => {
      const { repository, organization } = await setup();
      const publishedAt = subDays(new Date(), 1);
      const templates = await Promise.all([1, 2, 3].map(() => seedTemplate({ ...listed(organization.id), publishedAt })));
      await Promise.all(templates.map(template => seedTemplateVersion({ templateId: template.id })));
      await seedTemplateScore({ templateRef: templates[0].id, popularScore: 1 });

      const rows = await repository.list({ organizationId: organization.id, limit: 10 });

      expect(rows.map(row => row.id)).toEqual(templates.map(template => template.id).sort());
    });

    it("hands over the SDL only of a current version that recorded no resources", async () => {
      const { repository, organization } = await setup();
      const template = await seedTemplate(listed(organization.id));
      await seedTemplateVersion({ templateId: template.id, sdl: "version: '2.1'" });

      const [row] = await repository.list({ organizationId: organization.id, limit: 10 });

      expect(row).toMatchObject({ resources: null, sdlWithoutResources: "version: '2.1'" });
    });

    it.each<[string, Partial<TemplateInsert>]>([
      ["private", { visibility: "private" }],
      ["shared with its organization only", { visibility: "organization" }],
      ["public but not listed", { isListed: false }],
      ["public since before the publish gate", { publishedAt: null }],
      ["hidden by staff", { moderationStatus: "hidden" }],
      ["removed", { moderationStatus: "removed" }]
    ])("leaves out a template that is %s", async (_state, state) => {
      const { repository, organization } = await setup();
      const [shown, left] = await Promise.all([seedTemplate(listed(organization.id)), seedTemplate({ ...listed(organization.id), ...state })]);
      await Promise.all([seedTemplateVersion({ templateId: shown.id }), seedTemplateVersion({ templateId: left.id })]);

      const rows = await repository.list({ limit: 10_000 });
      const ids = rows.map(row => row.id);

      expect(ids).toContain(shown.id);
      expect(ids).not.toContain(left.id);
    });

    it.each<[string, Partial<TemplateVersionInsert>[]]>([
      ["no version at all", []],
      ["a current version that is held", [{ version: 1, status: "held" }]],
      ["a current version that failed its checks", [{ version: 1, status: "failed_checks" }]],
      ["a current version staff rejected", [{ version: 1, status: "rejected" }]]
    ])("leaves out a template with %s", async (_state, versions) => {
      const { repository, organization } = await setup();
      const template = await seedTemplate(listed(organization.id));
      await Promise.all(versions.map(version => seedTemplateVersion({ templateId: template.id, ...version })));

      expect(await repository.list({ organizationId: organization.id, limit: 10 })).toEqual([]);
    });

    it.each<[string, Partial<TemplateVersionInsert>]>([
      ["held", { status: "held", holdReasons: [{ kind: "official_template", message: "Waits for staff" }] }],
      ["failed its checks", { status: "failed_checks" }]
    ])("lists a template by its live current version while its newest version %s", async (_state, newest) => {
      const { repository, organization } = await setup();
      const template = await seedTemplate(listed(organization.id));
      await seedTemplateVersion({ templateId: template.id, version: 1, resources: RESOURCES });
      await seedTemplateVersion({ templateId: template.id, version: 2, resources: { ...RESOURCES, cpu: 64 }, isCurrent: false, ...newest });

      const rows = await repository.list({ organizationId: organization.id, limit: 10 });

      expect(rows).toMatchObject([{ id: template.id, resources: RESOURCES, versionCount: 1 }]);
    });

    it("leaves out every template of a suspended publisher and of a deleted organization, and lists them again once reinstated", async () => {
      const { repository, organization } = await setup({ publisher: { publishingSuspendedAt: new Date(), publishingSuspendedReason: "Miners" } });
      const { organization: deleted } = await setup({ organization: { deletedAt: new Date() } });
      const [suspendedTemplate, deletedTemplate] = await Promise.all([seedTemplate(listed(organization.id)), seedTemplate(listed(deleted.id))]);
      await Promise.all([seedTemplateVersion({ templateId: suspendedTemplate.id }), seedTemplateVersion({ templateId: deletedTemplate.id })]);

      const whileSuspended = await repository.list({ limit: 10_000 });
      await reinstate(organization.id);
      const onceReinstated = await repository.list({ limit: 10_000 });

      expect(whileSuspended.map(row => row.id)).not.toContain(suspendedTemplate.id);
      expect(whileSuspended.map(row => row.id)).not.toContain(deletedTemplate.id);
      expect(onceReinstated.map(row => row.id)).toContain(suspendedTemplate.id);
    });

    it("lists the newest published first, of one publisher when asked, and stops at the limit", async () => {
      const { repository, organization } = await setup();
      const { organization: other } = await setup();
      const [older, newer, foreign] = await Promise.all([
        seedTemplate({ ...listed(organization.id), publishedAt: subDays(new Date(), 3) }),
        seedTemplate({ ...listed(organization.id), publishedAt: subDays(new Date(), 1) }),
        seedTemplate({ ...listed(other.id), publishedAt: subDays(new Date(), 2) })
      ]);
      await Promise.all([older, newer, foreign].map(template => seedTemplateVersion({ templateId: template.id })));

      const ofPublisher = await repository.list({ organizationId: organization.id, limit: 10 });
      const firstOfPublisher = await repository.list({ organizationId: organization.id, limit: 1 });
      const ofEveryone = await repository.list({ limit: 10_000 });
      const seededOrder = ofEveryone.map(row => row.id).filter(id => [older.id, newer.id, foreign.id].includes(id));

      expect(ofPublisher.map(row => row.id)).toEqual([newer.id, older.id]);
      expect(firstOfPublisher.map(row => row.id)).toEqual([newer.id]);
      expect(seededOrder).toEqual([newer.id, foreign.id, older.id]);
    });
  });

  describe("countOfPublisher", () => {
    it("counts the templates the publisher lists and their mainnet deploys from outside its organization", async () => {
      const { repository, organization } = await setup();
      const { organization: other } = await setup();
      const [first, second, unlisted, foreign] = await Promise.all([
        seedTemplate(listed(organization.id)),
        seedTemplate(listed(organization.id)),
        seedTemplate({ ...listed(organization.id), moderationStatus: "hidden" }),
        seedTemplate(listed(other.id))
      ]);
      await Promise.all([first, second, unlisted, foreign].map(template => seedTemplateVersion({ templateId: template.id })));
      await seedTemplateDeployers(first.id, 3);
      await seedTemplateDeployers(second.id, 2);
      await seedTemplateDeployers(first.id, 4, { organizationId: organization.id });
      await seedTemplateDeployers(first.id, 5, { network: "sandbox" });
      await seedTemplateDeployers(first.id, 6, { action: "lease_created" });
      await seedTemplateDeployers(first.id, 7, { source: "awesome_akash" });
      await seedTemplateDeployers(unlisted.id, 8);
      await seedTemplateDeployers(foreign.id, 9);

      expect(await repository.countOfPublisher(organization.id)).toEqual({ templates: 2, deploys: 5 });
    });

    it("counts nothing for an organization that lists no template", async () => {
      const { repository, organization } = await setup();
      const template = await seedTemplate({ ...listed(organization.id), visibility: "private" });
      await seedTemplateVersion({ templateId: template.id });
      await seedTemplateDeployers(template.id, 2);

      expect(await repository.countOfPublisher(organization.id)).toEqual({ templates: 0, deploys: 0 });
    });
  });

  function listed(organizationId: string): Partial<TemplateInsert> {
    return { organizationId, visibility: "public", isPublic: true, isListed: true, moderationStatus: "active", publishedAt: new Date() };
  }

  async function findStoredTemplate(id: string) {
    const templates = resolveTable("Templates");
    const [template] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(templates).where(eq(templates.id, id));

    return template;
  }

  async function reinstate(organizationId: string) {
    const publishers = resolveTable("TemplatePublishers");
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .update(publishers)
      .set({ publishingSuspendedAt: null, publishingSuspendedReason: null })
      .where(eq(publishers.organizationId, organizationId));
  }

  async function setup(
    input: {
      organization?: Parameters<typeof seedOrganization>[0];
      publisher?: Partial<ApiPgTables["TemplatePublishers"]["$inferInsert"]>;
    } = {}
  ) {
    const organization = await seedOrganization({ name: `Lab ${faker.string.alphanumeric(8)}`, ...input.organization });
    const publisher = await seedTemplatePublisher({ organizationId: organization.id, ...input.publisher });

    return { repository: container.resolve(CommunityTemplateRepository), organization, publisher };
  }
});
