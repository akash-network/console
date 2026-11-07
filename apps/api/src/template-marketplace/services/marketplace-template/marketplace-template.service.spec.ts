import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type {
  MarketplaceTemplateRepository,
  MarketplaceTemplateRow
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import type {
  TemplateVersionOutput,
  TemplateVersionRepository,
  TemplateVersionSummary
} from "@src/template-marketplace/repositories/template-version/template-version.repository";
import { MarketplaceTemplateService } from "./marketplace-template.service";

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

describe(MarketplaceTemplateService.name, () => {
  describe("getTemplate", () => {
    it("describes a readable template with its author, publisher and current version without image digests", async () => {
      const template = createTemplateRow({ authorUsername: "alice", publisher: { name: "Team", slug: "team", type: "team" } });
      const version = createVersion({ templateId: template.id, readme: "# Readme", resources: { cpu: 1, memoryBytes: 2, storageBytes: 3 } });
      const { service } = setup({ template, currentVersion: version });

      const result = await service.getTemplate(template.id);

      const { imageDigests: _imageDigests, ...publishedVersion } = version;
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
        copiedFromId: template.copiedFromId,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        author: { username: "alice" },
        publisher: { name: "Team", slug: "team", type: "team" },
        currentVersion: publishedVersion,
        canEdit: false
      });
    });

    it("names no author when the author's account is gone", async () => {
      const template = createTemplateRow({ authorUsername: null, publisher: null });
      const { service } = setup({ template });

      const result = await service.getTemplate(template.id);

      expect(result).toMatchObject({ author: null, publisher: null });
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

    it("reports no current version for a template saved without one", async () => {
      const template = createTemplateRow();
      const { service } = setup({ template, currentVersion: undefined });

      const result = await service.getTemplate(template.id);

      expect(result.currentVersion).toBeNull();
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
      const { service, repository } = setup({ rules });

      repository.findReadable.mockResolvedValueOnce(editable).mockResolvedValueOnce(elsewhere);
      const results = [await service.getTemplate(editable.id), await service.getTemplate(elsewhere.id)];

      expect(results.map(({ canEdit }) => canEdit)).toEqual([true, false]);
    });

    it("checks the update rule against the template's owner and visibility", async () => {
      const userId = faker.string.uuid();
      const owned = createTemplateRow({ organizationId: null, projectId: null, userId, visibility: "organization" });
      const { service } = setup({ template: owned, rules: [{ action: "update", subject: "Template", conditions: { userId, visibility: "organization" } }] });

      const result = await service.getTemplate(owned.id);

      expect(result.canEdit).toBe(true);
    });

    it("checks the update rule against every field of the template", async () => {
      const active = createTemplateRow({ moderationStatus: "active" });
      const hidden = createTemplateRow({ moderationStatus: "hidden" });
      const { service, repository } = setup({ rules: [{ action: "update", subject: "Template", conditions: { moderationStatus: "active" } }] });

      repository.findReadable.mockResolvedValueOnce(active).mockResolvedValueOnce(hidden);
      const results = [await service.getTemplate(active.id), await service.getTemplate(hidden.id)];

      expect(results.map(({ canEdit }) => canEdit)).toEqual([true, false]);
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

    it("refuses an unreadable template with 404", async () => {
      const { service, templateVersionRepository } = setup({ template: undefined });

      await expect(service.getTemplate(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Template not found" });
      expect(templateVersionRepository.findCurrent).not.toHaveBeenCalled();
    });
  });

  describe("listVersions", () => {
    it("lists the versions of a readable template", async () => {
      const template = createTemplateRow();
      const summaries: TemplateVersionSummary[] = [createSummary({ templateId: template.id, version: 2 }), createSummary({ templateId: template.id, version: 1 })];
      const { service, templateVersionRepository } = setup({ template });
      templateVersionRepository.listByTemplate.mockResolvedValue(summaries);

      const result = await service.listVersions(template.id);

      expect(result).toEqual(summaries);
      expect(templateVersionRepository.listByTemplate).toHaveBeenCalledWith(template.id);
    });

    it("refuses an unreadable template with 404", async () => {
      const { service, templateVersionRepository } = setup({ template: undefined });

      await expect(service.listVersions(faker.string.uuid())).rejects.toMatchObject({ status: 404 });
      expect(templateVersionRepository.listByTemplate).not.toHaveBeenCalled();
    });
  });

  describe("getVersion", () => {
    it("reads one version of a readable template without its image digests", async () => {
      const template = createTemplateRow();
      const version = createVersion({ templateId: template.id, version: 3, imageDigests: { "nginx:latest": "sha256:abc" } });
      const { service, templateVersionRepository } = setup({ template });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(version);

      const result = await service.getVersion(template.id, 3);

      const { imageDigests: _imageDigests, ...published } = version;
      expect(result).toEqual(published);
      expect(templateVersionRepository.findByTemplateAndVersion).toHaveBeenCalledWith(template.id, 3);
    });

    it("refuses a version number the template does not have with 404", async () => {
      const template = createTemplateRow();
      const { service, templateVersionRepository } = setup({ template });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(undefined);

      await expect(service.getVersion(template.id, 9)).rejects.toMatchObject({ status: 404, message: "Template version not found" });
    });

    it("refuses an unreadable template with 404 before looking for the version", async () => {
      const { service, templateVersionRepository } = setup({ template: undefined });

      await expect(service.getVersion(faker.string.uuid(), 1)).rejects.toMatchObject({ status: 404, message: "Template not found" });
      expect(templateVersionRepository.findByTemplateAndVersion).not.toHaveBeenCalled();
    });
  });

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
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      authorUsername: faker.internet.userName(),
      publisher: { name: faker.company.name(), slug: faker.lorem.slug(), type: "team" },
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
      createdById: faker.string.uuid(),
      createdAt: faker.date.recent(),
      ...overrides
    };
  }

  function createSummary(overrides: Partial<TemplateVersionSummary> = {}): TemplateVersionSummary {
    const { sdl: _sdl, readme: _readme, askedValues: _askedValues, imageDigests: _imageDigests, ...summary } = createVersion();

    return { ...summary, ...overrides };
  }

  function setup(input: { template?: MarketplaceTemplateRow; currentVersion?: TemplateVersionOutput; rules?: RawRuleOf<MongoAbility>[] } = {}) {
    const ability = createMongoAbility<MongoAbility>(input.rules ?? []);
    const authService = mock<AuthService>();
    authService.ability = ability;
    const readableRepository = mock<MarketplaceTemplateRepository>();
    const repository = mock<MarketplaceTemplateRepository>();
    repository.accessibleBy.mockReturnValue(readableRepository);
    readableRepository.findReadable.mockImplementation(repository.findReadable);
    const template = "template" in input ? input.template : createTemplateRow();
    repository.findReadable.mockResolvedValue(template);
    const templateVersionRepository = mock<TemplateVersionRepository>();
    templateVersionRepository.findCurrent.mockResolvedValue("currentVersion" in input ? input.currentVersion : createVersion());
    const service = new MarketplaceTemplateService(repository, templateVersionRepository, authService);

    return { service, repository, readableRepository, templateVersionRepository, ability };
  }
});
