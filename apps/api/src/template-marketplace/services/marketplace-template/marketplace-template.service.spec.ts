import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { PublishCheckResults } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import type { TemplateVersionHoldReason } from "@src/template-marketplace/lib/version-hold/version-hold-reasons";
import type { CommunityTemplateRepository, PublisherCounts } from "@src/template-marketplace/repositories/community-template/community-template.repository";
import type {
  MarketplaceTemplateRepository,
  MarketplaceTemplateRow,
  UserTemplateListRow
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import type {
  TemplatePublisherProfile,
  TemplatePublisherRepository
} from "@src/template-marketplace/repositories/template-publisher/template-publisher.repository";
import type { TemplateRemovalRepository } from "@src/template-marketplace/repositories/template-removal/template-removal.repository";
import type {
  TemplateUsageEventRepository,
  TemplateUsageSummary
} from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import type {
  TemplateVersionOutput,
  TemplateVersionRepository,
  TemplateVersionSummary
} from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type { UserOutput } from "@src/user/repositories";
import type { UserTemplateRepository } from "@src/user/repositories/user-template/user-template.repository";
import { MarketplaceTemplateService } from "./marketplace-template.service";

import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

const SDL = [
  "version: '2.0'",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 2",
  "        memory:",
  "          size: 1Gi",
  "        storage:",
  "          size: 2Gi",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 1"
].join("\n");

const CHECK_RESULTS: PublishCheckResults = {
  ranAt: "2026-11-18T10:00:00.000Z",
  checks: [{ key: "fixed_tags", status: "failed", issues: [{ message: "Pin the tag", service: "web", image: "nginx" }] }]
};

describe(MarketplaceTemplateService.name, () => {
  describe("getTemplate", () => {
    it("describes a readable template with its author, publisher and current version, image digests included", async () => {
      const template = createTemplateRow({ authorUsername: "alice", publisher: { name: "Team", slug: "team", type: "team", handle: "team" } });
      const version = createVersion({
        templateId: template.id,
        readme: "# Readme",
        resources: { cpu: 1, memoryBytes: 2, storageBytes: 3 },
        imageDigests: { "nginx:1.27": "sha256:abc" }
      });
      const { service } = setup({ template, currentVersion: version, activeOrganizationId: template.organizationId });

      const result = await service.getTemplate(template.id);

      expect(result).toEqual({
        id: template.id,
        title: template.title,
        summary: template.summary,
        icon: template.icon,
        categories: template.categories,
        visibility: template.visibility,
        isListed: template.isListed,
        isOfficial: template.isOfficial,
        moderationStatus: template.moderationStatus,
        projectId: template.projectId,
        copiedFromId: template.copiedFromId,
        copiedFrom: null,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        publishedAt: null,
        author: { username: "alice" },
        publisher: {
          name: "Team",
          slug: "team",
          type: "team",
          handle: "team",
          verified: false,
          memberSince: null,
          counts: { templates: 0, deploys: 0 }
        },
        currentVersion: version,
        canEdit: false,
        isFavorite: false,
        usage: { deploys: 0, lastDeployedAt: null, stillUpAfter24h: null, forks: 0, favorites: 0 }
      });
    });

    it("describes the publisher as its page does once the organization has published", async () => {
      const template = createTemplateRow({ publisher: { name: "Team", slug: "team", type: "team", handle: "team" } });
      const memberSince = faker.date.past();
      const publisherProfile: TemplatePublisherProfile = {
        organizationId: template.organizationId,
        name: "Team",
        type: "team",
        handle: "team",
        bio: null,
        links: [],
        isVerified: true,
        isSuspended: false,
        memberSince
      };
      const { service, templatePublisherRepository, communityTemplateRepository } = setup({
        template,
        publisherProfile,
        publisherCounts: { templates: 7, deploys: 18_400 }
      });

      const result = await service.getTemplate(template.id);

      expect(result.publisher).toEqual({
        name: "Team",
        slug: "team",
        type: "team",
        handle: "team",
        verified: true,
        memberSince,
        counts: { templates: 7, deploys: 18_400 }
      });
      expect(templatePublisherRepository.findProfileOfOrganization).toHaveBeenCalledWith(template.organizationId);
      expect(communityTemplateRepository.countOfPublisher).toHaveBeenCalledWith(template.organizationId);
    });

    it("counts nothing for an organization that has not published yet", async () => {
      const template = createTemplateRow({ publisher: { name: "Team", slug: "team", type: "team", handle: null } });
      const { service, communityTemplateRepository } = setup({ template, publisherCounts: { templates: 3, deploys: 9 } });

      const result = await service.getTemplate(template.id);

      expect(result.publisher).toMatchObject({ verified: false, memberSince: null, counts: { templates: 0, deploys: 0 } });
      expect(communityTemplateRepository.countOfPublisher).not.toHaveBeenCalled();
    });

    it("counts the people who keep the template among their favorites", async () => {
      const template = createTemplateRow();
      const { service, userTemplateRepository } = setup({ template, favorites: 214 });

      const result = await service.getTemplate(template.id);

      expect(result.usage.favorites).toBe(214);
      expect(userTemplateRepository.countFavorites).toHaveBeenCalledWith(template.id);
    });

    it.each<[string, string, string | null]>([
      ["another organization is active", faker.string.uuid(), faker.string.uuid()],
      ["no organization is active", faker.string.uuid(), null]
    ])("withholds the project when %s", async (_case, organizationId, activeOrganizationId) => {
      const template = createTemplateRow({ organizationId });
      const { service } = setup({ template, activeOrganizationId });

      const result = await service.getTemplate(template.id);

      expect(result.projectId).toBeNull();
    });

    it("names the template it was copied from when the caller may read that one", async () => {
      const source = createTemplateRow();
      const template = createTemplateRow({ copiedFromId: source.id });
      const { service, repository } = setup({ template });
      repository.findReadable.mockImplementation(async id => ({ [template.id]: template, [source.id]: source })[id]);

      const result = await service.getTemplate(template.id);

      expect(result.copiedFromId).toBe(source.id);
      expect(result.copiedFrom).toEqual({ id: source.id, title: source.title });
      expect(repository.findReadable).toHaveBeenCalledWith(source.id);
    });

    it("withholds the template it was copied from when the caller may not read that one", async () => {
      const template = createTemplateRow({ copiedFromId: faker.string.uuid() });
      const { service, repository } = setup({ template });
      repository.findReadable.mockImplementation(async id => (id === template.id ? template : undefined));

      const result = await service.getTemplate(template.id);

      expect(result.copiedFromId).toBeNull();
      expect(result.copiedFrom).toBeNull();
    });

    it("looks up no source for a template that was not copied", async () => {
      const template = createTemplateRow({ copiedFromId: null });
      const { service, repository } = setup({ template });

      const result = await service.getTemplate(template.id);

      expect(result.copiedFromId).toBeNull();
      expect(result.copiedFrom).toBeNull();
      expect(repository.findReadable).toHaveBeenCalledTimes(1);
    });

    it("reports whether the caller has made the template a favorite", async () => {
      const template = createTemplateRow();
      const { service, userTemplateRepository, user } = setup({ template });
      userTemplateRepository.isFavorite.mockResolvedValue(true);

      const result = await service.getTemplate(template.id);

      expect(result.isFavorite).toBe(true);
      expect(userTemplateRepository.isFavorite).toHaveBeenCalledWith(template.id, user!.userId);
    });

    it("reports the template's usage", async () => {
      const template = createTemplateRow();
      const usage: TemplateUsageSummary = { deploys: 12, lastDeployedAt: faker.date.recent(), stillUpAfter24h: 0.75, forks: 4 };
      const { service, templateUsageEventRepository } = setup({ template, usages: new Map([[template.id, usage]]) });

      const result = await service.getTemplate(template.id);

      expect(result.usage).toEqual({ ...usage, favorites: 0 });
      expect(templateUsageEventRepository.summarize).toHaveBeenCalledWith([template.id]);
    });

    it.each<[string, Partial<UserOutput> | null]>([
      ["a caller without a session", null],
      ["a user without a sign-in subject", { userId: null }]
    ])("reports no favorite to %s without looking one up", async (_case, user) => {
      const template = createTemplateRow();
      const { service, userTemplateRepository } = setup({ template, user });

      const result = await service.getTemplate(template.id);

      expect(result.isFavorite).toBe(false);
      expect(userTemplateRepository.isFavorite).not.toHaveBeenCalled();
    });

    it("names no author when the author's account is gone", async () => {
      const template = createTemplateRow({ authorUsername: null, publisher: null });
      const { service } = setup({ template });

      const result = await service.getTemplate(template.id);

      expect(result).toMatchObject({ author: null, publisher: null });
    });

    it("withholds the slug of a personal organization publisher", async () => {
      const template = createTemplateRow({ publisher: { name: "Alice", slug: "personal-slug", type: "personal", handle: null } });
      const { service } = setup({ template });

      const result = await service.getTemplate(template.id);

      expect(result.publisher).toMatchObject({ name: "Alice", slug: null, type: "personal", handle: null });
    });

    it("tells when the template first went public", async () => {
      const publishedAt = new Date("2026-11-10T08:00:00.000Z");
      const template = createTemplateRow({ publishedAt });
      const { service } = setup({ template });

      const result = await service.getTemplate(template.id);

      expect(result.publishedAt).toEqual(publishedAt);
    });

    it("shows what the publish checks found on the current version to a caller who may edit the template only", async () => {
      const template = createTemplateRow({ visibility: "public" });
      const currentVersion = createVersion({ templateId: template.id, checkResults: CHECK_RESULTS });
      const asEditor = setup({ template, currentVersion, rules: [{ action: "update", subject: "Template" }] });
      const asReader = setup({ template, currentVersion, rules: [{ action: "read", subject: "Template" }] });

      const [forEditor, forReader] = await Promise.all([asEditor.service.getTemplate(template.id), asReader.service.getTemplate(template.id)]);

      expect(forEditor.currentVersion?.checkResults).toEqual(CHECK_RESULTS);
      expect(forReader.currentVersion?.checkResults).toBeNull();
    });

    it("falls back to the legacy description and the SDL's hardware for a version that recorded neither", async () => {
      const template = createTemplateRow({ description: "Legacy description" });
      const { service } = setup({ template, currentVersion: createVersion({ templateId: template.id, sdl: SDL, readme: null, resources: null }) });

      const result = await service.getTemplate(template.id);

      expect(result.currentVersion).toMatchObject({ readme: "Legacy description", resources: { cpu: 2, memoryBytes: 1024 ** 3, storageBytes: 2 * 1024 ** 3 } });
    });

    it("leaves the resources empty when the SDL cannot be read", async () => {
      const template = createTemplateRow({ description: null });
      const { service } = setup({ template, currentVersion: createVersion({ templateId: template.id, sdl: "not: [an sdl", readme: null, resources: null }) });

      const result = await service.getTemplate(template.id);

      expect(result.currentVersion).toMatchObject({ readme: null, resources: null });
    });

    it("reads an empty legacy description as no readme", async () => {
      const template = createTemplateRow({ description: "" });
      const { service } = setup({ template, currentVersion: createVersion({ templateId: template.id, readme: null }) });

      const result = await service.getTemplate(template.id);

      expect(result.currentVersion).toMatchObject({ readme: null });
    });

    it("reads the version the readable template pointed at", async () => {
      const template = createTemplateRow();
      const { service, templateVersionRepository } = setup({ template });

      await service.getTemplate(template.id);

      expect(templateVersionRepository.findById).toHaveBeenCalledWith(template.currentVersionId);
    });

    it("reports no current version for a template saved without one", async () => {
      const template = createTemplateRow({ currentVersionId: null });
      const { service, templateVersionRepository } = setup({ template, currentVersion: undefined });

      const result = await service.getTemplate(template.id);

      expect(result.currentVersion).toBeNull();
      expect(templateVersionRepository.findById).not.toHaveBeenCalled();
    });

    it("reports canEdit from the caller's update rule", async () => {
      const organizationId = faker.string.uuid();
      const projectId = faker.string.uuid();
      const editable = createTemplateRow({ organizationId, projectId });
      const elsewhere = createTemplateRow({ organizationId, projectId: faker.string.uuid() });
      const rules: RawRuleOf<MongoAbility>[] = [
        { action: "read", subject: "Template", conditions: { organizationId } },
        { action: "update", subject: "Template", conditions: { organizationId, projectId } }
      ];
      const { service, repository } = setup({ rules, activeOrganizationId: organizationId });

      repository.findReadable.mockResolvedValueOnce(editable).mockResolvedValueOnce(elsewhere);
      const results = [await service.getTemplate(editable.id), await service.getTemplate(elsewhere.id)];

      expect(results.map(({ canEdit }) => canEdit)).toEqual([true, false]);
    });

    it("checks the update rule against the template's owner and visibility", async () => {
      const userId = faker.string.uuid();
      const owned = createTemplateRow({ projectId: null, userId, visibility: "organization" });
      const { service } = setup({
        template: owned,
        rules: [{ action: "update", subject: "Template", conditions: { userId, visibility: "organization" } }],
        activeOrganizationId: owned.organizationId
      });

      const result = await service.getTemplate(owned.id);

      expect(result.canEdit).toBe(true);
    });

    it("checks the update rule against every field of the template", async () => {
      const organizationId = faker.string.uuid();
      const active = createTemplateRow({ organizationId, moderationStatus: "active" });
      const hidden = createTemplateRow({ organizationId, moderationStatus: "hidden" });
      const { service, repository } = setup({
        rules: [{ action: "update", subject: "Template", conditions: { moderationStatus: "active" } }],
        activeOrganizationId: organizationId
      });

      repository.findReadable.mockResolvedValueOnce(active).mockResolvedValueOnce(hidden);
      const results = [await service.getTemplate(active.id), await service.getTemplate(hidden.id)];

      expect(results.map(({ canEdit }) => canEdit)).toEqual([true, false]);
    });

    it.each<[string, string, string | null]>([
      ["a template of another organization", faker.string.uuid(), faker.string.uuid()],
      ["a request without an active organization", faker.string.uuid(), null]
    ])("offers no edit on %s even when the author's rule allows it", async (_case, organizationId, activeOrganizationId) => {
      const userId = faker.string.uuid();
      const template = createTemplateRow({ organizationId, userId });
      const { service } = setup({ template, rules: [{ action: "manage", subject: "Template", conditions: { userId } }], activeOrganizationId });

      const result = await service.getTemplate(template.id);

      expect(result.canEdit).toBe(false);
    });

    it("reads through the caller's read rules when it has any", async () => {
      const template = createTemplateRow();
      const { service, repository, readableRepository, ability } = setup({ template, rules: [{ action: "read", subject: "Template" }] });

      await service.getTemplate(template.id);

      expect(repository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(readableRepository.findReadable).toHaveBeenCalledWith(template.id);
    });

    it("reads public templates only, without attaching rules, for a caller with no read rule", async () => {
      const template = createTemplateRow();
      const { service, repository } = setup({ template, rules: [] });

      const result = await service.getTemplate(template.id);

      expect(repository.accessibleBy).not.toHaveBeenCalled();
      expect(repository.findReadable).toHaveBeenCalledWith(template.id);
      expect(result.canEdit).toBe(false);
    });

    it("answers 410 with the title for a removed template that was once public", async () => {
      const id = faker.string.uuid();
      const { service, templateRemovalRepository } = setup({ template: undefined, removedTitle: "Llama 3.1 Chat" });

      await expect(service.getTemplate(id)).rejects.toMatchObject({
        status: 410,
        message: "This template was removed",
        errorCode: "template_removed",
        data: { title: "Llama 3.1 Chat" }
      });
      expect(templateRemovalRepository.findRemovedTitle).toHaveBeenCalledWith(id);
    });

    it("answers 410 for a removed template whose title is empty", async () => {
      const { service } = setup({ template: undefined, removedTitle: "" });

      await expect(service.getTemplate(faker.string.uuid())).rejects.toMatchObject({ status: 410, data: { title: "" } });
    });

    it("looks for no removed page behind a template the caller may read", async () => {
      const template = createTemplateRow();
      const { service, templateRemovalRepository } = setup({ template });

      await service.getTemplate(template.id);

      expect(templateRemovalRepository.findRemovedTitle).not.toHaveBeenCalled();
    });

    it("refuses an unreadable template with 404", async () => {
      const { service, templateVersionRepository } = setup({ template: undefined });

      await expect(service.getTemplate(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Template not found" });
      expect(templateVersionRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe("listVersions", () => {
    it("lists a version that failed its checks, with what they found, to a caller who may edit the template", async () => {
      const template = createTemplateRow({ visibility: "public" });
      const failed = createSummary({ templateId: template.id, version: 2, status: "failed_checks", checkResults: CHECK_RESULTS });
      const current = createSummary({ id: template.currentVersionId!, templateId: template.id, version: 1 });
      const { service, templateVersionRepository } = setup({ template, rules: [{ action: "update", subject: "Template" }] });
      templateVersionRepository.listByTemplate.mockResolvedValue([failed, current]);

      const result = await service.listVersions(template.id);

      expect(result.map(({ version, status, checkResults }) => ({ version, status, checkResults }))).toEqual([
        { version: 2, status: "failed_checks", checkResults: CHECK_RESULTS },
        { version: 1, status: "live", checkResults: null }
      ]);
    });

    it("lists neither a failed version nor any check result to a caller who may not edit the template", async () => {
      const template = createTemplateRow({ visibility: "public" });
      const failed = createSummary({ templateId: template.id, version: 2, status: "failed_checks", checkResults: CHECK_RESULTS });
      const current = createSummary({ id: template.currentVersionId!, templateId: template.id, version: 1, checkResults: CHECK_RESULTS });
      const { service, templateVersionRepository } = setup({ template, rules: [{ action: "read", subject: "Template" }] });
      templateVersionRepository.listByTemplate.mockResolvedValue([failed, current]);

      const result = await service.listVersions(template.id);

      expect(result.map(({ version, checkResults }) => ({ version, checkResults }))).toEqual([{ version: 1, checkResults: null }]);
    });

    it("lists every version of the template to a caller who may edit it", async () => {
      const template = createTemplateRow();
      const summaries = [createSummary({ templateId: template.id, version: 2 }), createSummary({ templateId: template.id, version: 1 })];
      const { service, templateVersionRepository } = setup({ template, rules: [{ action: "update", subject: "Template" }] });
      templateVersionRepository.listByTemplate.mockResolvedValue(summaries);

      const result = await service.listVersions(template.id);

      expect(result).toEqual(summaries.map(summary => ({ ...summary, deploys: 0 })));
      expect(templateVersionRepository.listByTemplate).toHaveBeenCalledWith(template.id);
    });

    it("counts the deploys of each listed version", async () => {
      const template = createTemplateRow();
      const [second, first] = [createSummary({ templateId: template.id, version: 2 }), createSummary({ templateId: template.id, version: 1 })];
      const { service, templateVersionRepository, templateUsageEventRepository } = setup({ template, rules: [{ action: "update", subject: "Template" }] });
      templateVersionRepository.listByTemplate.mockResolvedValue([second, first]);
      templateUsageEventRepository.countDeploysByVersion.mockResolvedValue(new Map([[first.id, 4]]));

      const result = await service.listVersions(template.id);

      expect(result.map(({ id, deploys }) => ({ id, deploys }))).toEqual([
        { id: second.id, deploys: 0 },
        { id: first.id, deploys: 4 }
      ]);
      expect(templateUsageEventRepository.countDeploysByVersion).toHaveBeenCalledWith(template.id);
    });

    it("lists only the current version to a caller who may not edit the template", async () => {
      const current = createSummary({ version: 2 });
      const template = createTemplateRow({ currentVersionId: current.id });
      const { service, templateVersionRepository } = setup({ template });
      templateVersionRepository.listByTemplate.mockResolvedValue([current, createSummary({ templateId: template.id, version: 1 })]);

      const result = await service.listVersions(template.id);

      expect(result).toEqual([{ ...current, deploys: 0 }]);
    });

    it("refuses an unreadable template with 404", async () => {
      const { service, templateVersionRepository } = setup({ template: undefined });

      await expect(service.listVersions(faker.string.uuid())).rejects.toMatchObject({ status: 404 });
      expect(templateVersionRepository.listByTemplate).not.toHaveBeenCalled();
    });
  });

  describe("held and reviewed versions", () => {
    const HOLD_REASONS: TemplateVersionHoldReason[] = [{ kind: "global_port_added", message: "Opens port 22.", service: "web", port: 22, protocol: "tcp" }];
    const REVIEWED_AT = new Date("2026-11-10T09:00:00.000Z");
    const REVIEW = { holdReasons: HOLD_REASONS, reviewedAt: REVIEWED_AT, reviewNote: "Looks fine." };

    it.each(["held", "rejected"] as const)(
      "lists a %s version, with why it waited and what staff decided, to a caller who may edit the template",
      async status => {
        const template = createTemplateRow();
        const reviewed = createSummary({ templateId: template.id, version: 2, status, ...REVIEW });
        const current = createSummary({ id: template.currentVersionId!, templateId: template.id, version: 1 });
        const { service, templateVersionRepository } = setup({ template, rules: [{ action: "update", subject: "Template" }] });
        templateVersionRepository.listByTemplate.mockResolvedValue([reviewed, current]);

        const result = await service.listVersions(template.id);

        expect(result.map(({ version, status, holdReasons, reviewedAt, reviewNote }) => ({ version, status, holdReasons, reviewedAt, reviewNote }))).toEqual([
          { version: 2, status, ...REVIEW },
          { version: 1, status: "live", holdReasons: null, reviewedAt: null, reviewNote: null }
        ]);
      }
    );

    it.each(["held", "rejected"] as const)("lists no %s version, and nothing staff wrote about the current one, to a caller who may not edit", async status => {
      const template = createTemplateRow();
      const reviewed = createSummary({ templateId: template.id, version: 3, status, ...REVIEW });
      const current = createSummary({ id: template.currentVersionId!, templateId: template.id, version: 2, checkResults: CHECK_RESULTS, ...REVIEW });
      const { service, templateVersionRepository } = setup({ template });
      templateVersionRepository.listByTemplate.mockResolvedValue([reviewed, current]);

      const result = await service.listVersions(template.id);

      expect(result).toEqual([{ ...current, checkResults: null, holdReasons: null, reviewedAt: null, reviewNote: null, deploys: 0 }]);
    });

    it.each(["held", "rejected"] as const)(
      "reads a %s version with why it waited and what staff decided to a caller who may edit the template",
      async status => {
        const template = createTemplateRow();
        const reviewed = createVersion({ templateId: template.id, version: 2, status, ...REVIEW });
        const { service, templateVersionRepository } = setup({ template, rules: [{ action: "update", subject: "Template" }] });
        templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(reviewed);

        expect(await service.getVersion(template.id, 2)).toMatchObject({ id: reviewed.id, status, ...REVIEW });
      }
    );

    it.each(["held", "rejected"] as const)("answers 404 for a %s version to a caller who may not edit the template", async status => {
      const template = createTemplateRow();
      const { service, templateVersionRepository } = setup({ template });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(createVersion({ templateId: template.id, version: 2, status }));

      await expect(service.getVersion(template.id, 2)).rejects.toMatchObject({ status: 404 });
    });

    it("withholds why the current version once waited and what staff wrote from a caller who may not edit the template", async () => {
      const version = createVersion({ version: 3, ...REVIEW });
      const template = createTemplateRow({ currentVersionId: version.id });
      const { service, templateVersionRepository } = setup({ template, currentVersion: version });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(version);

      expect(await service.getVersion(template.id, 3)).toMatchObject({ holdReasons: null, reviewedAt: null, reviewNote: null });
      expect((await service.getTemplate(template.id)).currentVersion).toMatchObject({ holdReasons: null, reviewedAt: null, reviewNote: null });
    });

    it("shows an editor why the current version once waited and what staff wrote", async () => {
      const version = createVersion({ version: 3, ...REVIEW });
      const template = createTemplateRow({ currentVersionId: version.id });
      const { service } = setup({ template, currentVersion: version, rules: [{ action: "update", subject: "Template" }] });

      expect((await service.getTemplate(template.id)).currentVersion).toMatchObject(REVIEW);
    });

    it("lets only an editor deploy a held version", async () => {
      const template = createTemplateRow();
      const held = createVersion({ templateId: template.id, version: 2, status: "held" });
      const forEditor = setup({ template, rules: [{ action: "update", subject: "Template" }] });
      forEditor.templateVersionRepository.findById.mockResolvedValue(held);
      const forReader = setup({ template });
      forReader.templateVersionRepository.findById.mockResolvedValue(held);

      expect(await forEditor.service.findDeployableVersion(held.id)).toEqual({ templateId: template.id, versionId: held.id });
      await expect(forReader.service.findDeployableVersion(held.id)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("getVersion", () => {
    it("reads a version that failed its checks, with what they found, to a caller who may edit the template", async () => {
      const template = createTemplateRow({ visibility: "public" });
      const failed = createVersion({ templateId: template.id, version: 2, status: "failed_checks", checkResults: CHECK_RESULTS });
      const { service, templateVersionRepository } = setup({ template, rules: [{ action: "update", subject: "Template" }] });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(failed);

      const result = await service.getVersion(template.id, 2);

      expect(result).toMatchObject({ id: failed.id, status: "failed_checks", checkResults: CHECK_RESULTS });
    });

    it("answers 404 for a version that failed its checks to a caller who may not edit the template", async () => {
      const template = createTemplateRow({ visibility: "public" });
      const failed = createVersion({ templateId: template.id, version: 2, status: "failed_checks", checkResults: CHECK_RESULTS });
      const { service, templateVersionRepository } = setup({ template, rules: [{ action: "read", subject: "Template" }] });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(failed);

      await expect(service.getVersion(template.id, 2)).rejects.toMatchObject({ status: 404, message: "Template version not found" });
    });

    it("withholds the check results of the current version from a caller who may not edit the template", async () => {
      const version = createVersion({ version: 3, checkResults: CHECK_RESULTS });
      const template = createTemplateRow({ visibility: "public", currentVersionId: version.id });
      const { service, templateVersionRepository } = setup({ template, rules: [{ action: "read", subject: "Template" }] });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(version);

      const result = await service.getVersion(template.id, 3);

      expect(result.checkResults).toBeNull();
    });

    it("reads the current version with its image digests", async () => {
      const version = createVersion({ version: 3, imageDigests: { "nginx:latest": "sha256:abc" } });
      const template = createTemplateRow({ currentVersionId: version.id });
      const { service, templateVersionRepository } = setup({ template });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(version);

      const result = await service.getVersion(template.id, 3);

      expect(result).toEqual(version);
      expect(templateVersionRepository.findByTemplateAndVersion).toHaveBeenCalledWith(template.id, 3);
    });

    it("reads an earlier version to a caller who may edit the template", async () => {
      const template = createTemplateRow();
      const earlier = createVersion({ templateId: template.id, version: 1 });
      const { service, templateVersionRepository } = setup({ template, rules: [{ action: "update", subject: "Template" }] });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(earlier);

      const result = await service.getVersion(template.id, 1);

      expect(result).toMatchObject({ id: earlier.id, version: 1, sdl: earlier.sdl });
    });

    it("refuses an earlier version to a caller who may not edit the template with 404", async () => {
      const template = createTemplateRow();
      const { service, templateVersionRepository } = setup({ template, rules: [{ action: "read", subject: "Template" }] });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(createVersion({ templateId: template.id, version: 1 }));

      await expect(service.getVersion(template.id, 1)).rejects.toMatchObject({ status: 404, message: "Template version not found" });
    });

    it("falls back to the legacy description and the SDL's hardware for a version that recorded neither", async () => {
      const version = createVersion({ sdl: SDL, readme: null, resources: null });
      const template = createTemplateRow({ currentVersionId: version.id, description: "Legacy description" });
      const { service, templateVersionRepository } = setup({ template });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(version);

      const result = await service.getVersion(template.id, 1);

      expect(result).toMatchObject({ readme: "Legacy description", resources: { cpu: 2, memoryBytes: 1024 ** 3, storageBytes: 2 * 1024 ** 3 } });
    });

    it("refuses a version number the template does not have with 404", async () => {
      const template = createTemplateRow();
      const { service, templateVersionRepository } = setup({ template, rules: [{ action: "update", subject: "Template" }] });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(undefined);

      await expect(service.getVersion(template.id, 9)).rejects.toMatchObject({ status: 404, message: "Template version not found" });
    });

    it("refuses an unreadable template with 404 before looking for the version", async () => {
      const { service, templateVersionRepository } = setup({ template: undefined });

      await expect(service.getVersion(faker.string.uuid(), 1)).rejects.toMatchObject({ status: 404, message: "Template not found" });
      expect(templateVersionRepository.findByTemplateAndVersion).not.toHaveBeenCalled();
    });
  });

  describe("findDeployableVersion", () => {
    it("lets only an editor deploy a version that failed its checks", async () => {
      const template = createTemplateRow({ visibility: "public" });
      const failed = createVersion({ templateId: template.id, version: 2, status: "failed_checks", checkResults: CHECK_RESULTS });
      const asEditor = setup({ template, rules: [{ action: "update", subject: "Template" }] });
      const asReader = setup({ template, rules: [{ action: "read", subject: "Template" }] });
      asEditor.templateVersionRepository.findById.mockResolvedValue(failed);
      asReader.templateVersionRepository.findById.mockResolvedValue(failed);

      const results = await Promise.allSettled([asEditor.service.findDeployableVersion(failed.id), asReader.service.findDeployableVersion(failed.id)]);

      expect(results).toEqual([
        { status: "fulfilled", value: { templateId: template.id, versionId: failed.id } },
        { status: "rejected", reason: expect.objectContaining({ status: 404, message: "Template version not found" }) }
      ]);
    });

    it("answers 404 rather than the removed page for a version of a removed template", async () => {
      const version = createVersion();
      const { service, templateVersionRepository, templateRemovalRepository } = setup({ template: undefined, removedTitle: "Llama 3.1 Chat" });
      templateVersionRepository.findById.mockResolvedValue(version);

      await expect(service.findDeployableVersion(version.id)).rejects.toMatchObject({ status: 404, message: "Template version not found" });
      expect(templateRemovalRepository.findRemovedTitle).not.toHaveBeenCalled();
    });

    it("lets an editor deploy an earlier version", async () => {
      const template = createTemplateRow();
      const earlier = createVersion({ templateId: template.id, version: 1 });
      const { service, repository, templateVersionRepository } = setup({ template, rules: [{ action: "update", subject: "Template" }] });
      templateVersionRepository.findById.mockResolvedValue(earlier);

      const result = await service.findDeployableVersion(earlier.id);

      expect(result).toEqual({ templateId: template.id, versionId: earlier.id });
      expect(templateVersionRepository.findById).toHaveBeenCalledWith(earlier.id);
      expect(repository.findReadable).toHaveBeenCalledWith(template.id);
    });

    it("lets a reader deploy only the current version", async () => {
      const current = createVersion({ version: 2 });
      const template = createTemplateRow({ currentVersionId: current.id });
      const earlier = createVersion({ templateId: template.id, version: 1 });
      const { service, templateVersionRepository } = setup({ template, rules: [{ action: "read", subject: "Template" }] });
      templateVersionRepository.findById.mockImplementation(async id => [current, earlier].find(version => version.id === id));

      const results = await Promise.allSettled([service.findDeployableVersion(current.id), service.findDeployableVersion(earlier.id)]);

      expect(results).toEqual([
        { status: "fulfilled", value: { templateId: template.id, versionId: current.id } },
        { status: "rejected", reason: expect.objectContaining({ status: 404, message: "Template version not found" }) }
      ]);
    });

    it("refuses a version of a template the caller may not read with 404 naming the version", async () => {
      const { service, templateVersionRepository } = setup({ template: undefined });
      templateVersionRepository.findById.mockResolvedValue(createVersion());

      await expect(service.findDeployableVersion(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Template version not found" });
    });

    it("refuses an unknown version with 404 before looking for a template", async () => {
      const { service, repository, templateVersionRepository } = setup();
      templateVersionRepository.findById.mockResolvedValue(undefined);

      await expect(service.findDeployableVersion(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Template version not found" });
      expect(repository.findReadable).not.toHaveBeenCalled();
    });
  });

  describe("listInOrganization", () => {
    it("lists the active organization's templates within the caller's read rules, at most 200", async () => {
      const organizationId = faker.string.uuid();
      const projectId = faker.string.uuid();
      const editable = createListRow({ organizationId, projectId, lastEditedByUsername: "alice" });
      const readOnly = createListRow({ organizationId, projectId: faker.string.uuid(), currentVersion: null, lastEditedByUsername: null });
      const rules: RawRuleOf<MongoAbility>[] = [
        { action: "read", subject: "Template", conditions: { organizationId } },
        { action: "update", subject: "Template", conditions: { organizationId, projectId } }
      ];
      const { service, repository, readableRepository, ability } = setup({ rules, activeOrganizationId: organizationId });
      readableRepository.listInOrganization.mockResolvedValue([editable, readOnly]);

      const result = await service.listInOrganization({ visibility: "organization", projectId });

      expect(repository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(readableRepository.listInOrganization).toHaveBeenCalledWith({ organizationId, visibility: "organization", projectId, limit: 200 });
      expect(result).toEqual([
        {
          id: editable.id,
          title: editable.title,
          summary: editable.summary,
          icon: editable.icon,
          categories: editable.categories,
          visibility: editable.visibility,
          isListed: editable.isListed,
          moderationStatus: editable.moderationStatus,
          projectId,
          copiedFromId: editable.copiedFromId,
          publishedAt: editable.publishedAt,
          updatedAt: editable.updatedAt,
          currentVersion: editable.currentVersion,
          latestVersion: null,
          lastEditedBy: { username: "alice" },
          canEdit: true,
          usage: { deploys: 0, lastDeployedAt: null }
        },
        expect.objectContaining({ id: readOnly.id, currentVersion: null, lastEditedBy: null, canEdit: false })
      ]);
    });

    it("lists the template a row was copied from only when the caller may read it", async () => {
      const organizationId = faker.string.uuid();
      const readableSourceId = faker.string.uuid();
      const unreadableSourceId = faker.string.uuid();
      const fromReadable = createListRow({ organizationId, copiedFromId: readableSourceId });
      const alsoFromReadable = createListRow({ organizationId, copiedFromId: readableSourceId });
      const fromUnreadable = createListRow({ organizationId, copiedFromId: unreadableSourceId });
      const original = createListRow({ organizationId, copiedFromId: null });
      const { service, readableRepository } = setup({ rules: [{ action: "read", subject: "Template" }], activeOrganizationId: organizationId });
      readableRepository.listInOrganization.mockResolvedValue([fromReadable, alsoFromReadable, fromUnreadable, original]);
      readableRepository.findReadableIds.mockResolvedValue(new Set([readableSourceId]));

      const result = await service.listInOrganization({});

      expect(readableRepository.findReadableIds).toHaveBeenCalledWith([readableSourceId, unreadableSourceId]);
      expect(result.map(item => item.copiedFromId)).toEqual([readableSourceId, readableSourceId, null, null]);
    });

    it("shows each listed template's deploys and last deploy, read in one summary", async () => {
      const organizationId = faker.string.uuid();
      const [deployed, quiet] = [createListRow({ organizationId }), createListRow({ organizationId })];
      const lastDeployedAt = faker.date.recent();
      const { service, readableRepository, templateUsageEventRepository } = setup({
        rules: [{ action: "read", subject: "Template" }],
        activeOrganizationId: organizationId,
        usages: new Map([[deployed.id, { deploys: 3, lastDeployedAt, stillUpAfter24h: 0.5, forks: 0 }]])
      });
      readableRepository.listInOrganization.mockResolvedValue([deployed, quiet]);

      const result = await service.listInOrganization({});

      expect(result.map(({ id, usage }) => ({ id, usage }))).toEqual([
        { id: deployed.id, usage: { deploys: 3, lastDeployedAt } },
        { id: quiet.id, usage: { deploys: 0, lastDeployedAt: null } }
      ]);
      expect(templateUsageEventRepository.summarize).toHaveBeenCalledTimes(1);
      expect(templateUsageEventRepository.summarize).toHaveBeenCalledWith([deployed.id, quiet.id]);
    });

    it("tells when each template first went public and, to a caller who may edit it only, what became of its newest version", async () => {
      const organizationId = faker.string.uuid();
      const projectId = faker.string.uuid();
      const publishedAt = new Date("2026-11-01T10:00:00.000Z");
      const editable = createListRow({ organizationId, projectId, publishedAt });
      const readOnly = createListRow({ organizationId, projectId: faker.string.uuid() });
      const rules: RawRuleOf<MongoAbility>[] = [
        { action: "read", subject: "Template", conditions: { organizationId } },
        { action: "update", subject: "Template", conditions: { organizationId, projectId } }
      ];
      const { service, readableRepository, templateVersionRepository } = setup({ rules, activeOrganizationId: organizationId });
      readableRepository.listInOrganization.mockResolvedValue([editable, readOnly]);
      templateVersionRepository.findNewestOf.mockResolvedValue(new Map([[editable.id, { version: 3, status: "held" }]]));

      const result = await service.listInOrganization({});

      expect(result.map(({ id, publishedAt, latestVersion, canEdit }) => ({ id, publishedAt, latestVersion, canEdit }))).toEqual([
        { id: editable.id, publishedAt, latestVersion: { version: 3, status: "held" }, canEdit: true },
        { id: readOnly.id, publishedAt: null, latestVersion: null, canEdit: false }
      ]);
      expect(templateVersionRepository.findNewestOf).toHaveBeenCalledTimes(1);
      expect(templateVersionRepository.findNewestOf).toHaveBeenCalledWith([editable.id]);
    });

    it("lists nothing to a caller whose rules reach no template", async () => {
      const { service, repository } = setup({ rules: [], activeOrganizationId: faker.string.uuid() });

      expect(await service.listInOrganization({})).toEqual([]);
      expect(repository.accessibleBy).not.toHaveBeenCalled();
    });

    it("lists nothing without an active organization", async () => {
      const { service, repository } = setup({ rules: [{ action: "read", subject: "Template" }], activeOrganizationId: null });

      expect(await service.listInOrganization({})).toEqual([]);
      expect(repository.accessibleBy).not.toHaveBeenCalled();
    });
  });

  function createListRow(overrides: Partial<UserTemplateListRow> = {}): UserTemplateListRow {
    return {
      id: faker.string.uuid(),
      userId: `auth0|${faker.string.alphanumeric(24)}`,
      organizationId: faker.string.uuid(),
      projectId: faker.string.uuid(),
      copiedFromId: null,
      title: faker.lorem.words(3),
      summary: faker.lorem.sentence(),
      icon: "rocket",
      categories: ["Tools"],
      visibility: "private",
      isListed: true,
      moderationStatus: "active",
      publishedAt: null,
      updatedAt: faker.date.recent(),
      currentVersion: { version: 2, status: "live", createdAt: faker.date.recent() },
      lastEditedByUsername: faker.internet.userName(),
      ...overrides
    };
  }

  function createTemplateRow(overrides: Partial<MarketplaceTemplateRow> = {}): MarketplaceTemplateRow {
    return {
      id: faker.string.uuid(),
      userId: `auth0|${faker.string.alphanumeric(24)}`,
      organizationId: faker.string.uuid(),
      projectId: faker.string.uuid(),
      copiedFromId: null,
      title: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      isPublic: false,
      cpu: 1000,
      ram: 1024,
      storage: 1024,
      sdl: SDL,
      authorId: faker.string.uuid(),
      summary: faker.lorem.sentence(),
      icon: "rocket",
      categories: ["AI - GPU"],
      visibility: "private",
      isListed: true,
      isOfficial: false,
      isFeatured: false,
      moderationStatus: "active",
      currentVersionId: faker.string.uuid(),
      publishedAt: null,
      removedAt: null,
      removedBy: null,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      authorUsername: faker.internet.userName(),
      publisher: { name: faker.company.name(), slug: faker.lorem.slug(), type: "team", handle: null },
      ...overrides
    };
  }

  function createVersion(overrides: Partial<TemplateVersionOutput> = {}): TemplateVersionOutput {
    return {
      id: faker.string.uuid(),
      templateId: faker.string.uuid(),
      version: 1,
      sdl: SDL,
      readme: faker.lorem.paragraph(),
      askedValues: [],
      resources: { cpu: 1, memoryBytes: 1024, storageBytes: 1024 },
      imageDigests: {},
      status: "live",
      checkResults: null,
      changes: ["first_version"],
      holdReasons: null,
      reviewedAt: null,
      reviewNote: null,
      createdById: faker.string.uuid(),
      createdBy: { username: faker.internet.userName() },
      createdAt: faker.date.recent(),
      ...overrides
    };
  }

  function createSummary(overrides: Partial<TemplateVersionSummary> = {}): TemplateVersionSummary {
    const { sdl: _sdl, readme: _readme, askedValues: _askedValues, imageDigests: _imageDigests, ...summary } = createVersion();

    return { ...summary, ...overrides };
  }

  function setup(
    input: {
      template?: MarketplaceTemplateRow;
      currentVersion?: TemplateVersionOutput;
      rules?: RawRuleOf<MongoAbility>[];
      user?: Partial<UserOutput> | null;
      activeOrganizationId?: string | null;
      usages?: Map<string, TemplateUsageSummary>;
      removedTitle?: string;
      favorites?: number;
      publisherProfile?: TemplatePublisherProfile;
      publisherCounts?: PublisherCounts;
    } = {}
  ) {
    const ability = createMongoAbility<MongoAbility>(input.rules ?? []);
    const user =
      input.user === null ? undefined : mock<UserOutput>({ id: faker.string.uuid(), userId: `auth0|${faker.string.alphanumeric(24)}`, ...input.user });
    const authService = mock<AuthService>({ safeCurrentUser: user });
    authService.ability = ability;
    const readableRepository = mock<MarketplaceTemplateRepository>();
    const repository = mock<MarketplaceTemplateRepository>();
    repository.accessibleBy.mockReturnValue(readableRepository);
    readableRepository.findReadable.mockImplementation(repository.findReadable);
    readableRepository.findReadableIds.mockResolvedValue(new Set());
    const template = "template" in input ? input.template : createTemplateRow();
    repository.findReadable.mockResolvedValue(template);
    const templateVersionRepository = mock<TemplateVersionRepository>();
    templateVersionRepository.findById.mockResolvedValue("currentVersion" in input ? input.currentVersion : createVersion());
    templateVersionRepository.findNewestOf.mockResolvedValue(new Map());
    const userTemplateRepository = mock<UserTemplateRepository>();
    userTemplateRepository.isFavorite.mockResolvedValue(false);
    userTemplateRepository.countFavorites.mockResolvedValue(input.favorites ?? 0);
    const executionContextService = mock<ExecutionContextService>();
    const activeOrganizationId = input.activeOrganizationId === undefined ? faker.string.uuid() : input.activeOrganizationId;
    executionContextService.get
      .calledWith("ORGANIZATION_CONTEXT")
      .mockReturnValue(activeOrganizationId ? createOrganizationContext({ organizationId: activeOrganizationId }) : undefined);
    const templateUsageEventRepository = mock<TemplateUsageEventRepository>();
    templateUsageEventRepository.summarize.mockResolvedValue(input.usages ?? new Map());
    templateUsageEventRepository.countDeploysByVersion.mockResolvedValue(new Map());
    const templateRemovalRepository = mock<TemplateRemovalRepository>();
    templateRemovalRepository.findRemovedTitle.mockResolvedValue(input.removedTitle);
    const templatePublisherRepository = mock<TemplatePublisherRepository>();
    templatePublisherRepository.findProfileOfOrganization.mockResolvedValue(input.publisherProfile);
    const communityTemplateRepository = mock<CommunityTemplateRepository>();
    communityTemplateRepository.countOfPublisher.mockResolvedValue(input.publisherCounts ?? { templates: 0, deploys: 0 });
    const service = new MarketplaceTemplateService(
      repository,
      templateVersionRepository,
      userTemplateRepository,
      authService,
      executionContextService,
      templateUsageEventRepository,
      templateRemovalRepository,
      templatePublisherRepository,
      communityTemplateRepository
    );

    return {
      service,
      repository,
      readableRepository,
      templateVersionRepository,
      userTemplateRepository,
      templateUsageEventRepository,
      templateRemovalRepository,
      templatePublisherRepository,
      communityTemplateRepository,
      ability,
      user
    };
  }
});
