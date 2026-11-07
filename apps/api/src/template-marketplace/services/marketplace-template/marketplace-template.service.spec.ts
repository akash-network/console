import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type {
  MarketplaceTemplateRepository,
  MarketplaceTemplateRow,
  UserTemplateListRow
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
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
        projectId: template.projectId,
        copiedFromId: template.copiedFromId,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        author: { username: "alice" },
        publisher: { name: "Team", slug: "team", type: "team" },
        currentVersion: publishedVersion,
        canEdit: false,
        isFavorite: false
      });
    });

    it("reports whether the caller has made the template a favorite", async () => {
      const template = createTemplateRow();
      const { service, userTemplateRepository, user } = setup({ template });
      userTemplateRepository.isFavorite.mockResolvedValue(true);

      const result = await service.getTemplate(template.id);

      expect(result.isFavorite).toBe(true);
      expect(userTemplateRepository.isFavorite).toHaveBeenCalledWith(template.id, user!.userId);
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
      const template = createTemplateRow({ publisher: { name: "Alice", slug: "personal-slug", type: "personal" } });
      const { service } = setup({ template });

      const result = await service.getTemplate(template.id);

      expect(result.publisher).toEqual({ name: "Alice", slug: null, type: "personal" });
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
      expect(templateVersionRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe("listVersions", () => {
    it("lists every version of the template to a caller who may edit it", async () => {
      const template = createTemplateRow();
      const summaries = [createSummary({ templateId: template.id, version: 2 }), createSummary({ templateId: template.id, version: 1 })];
      const { service, templateVersionRepository } = setup({ template, rules: [{ action: "update", subject: "Template" }] });
      templateVersionRepository.listByTemplate.mockResolvedValue(summaries);

      const result = await service.listVersions(template.id);

      expect(result).toEqual(summaries);
      expect(templateVersionRepository.listByTemplate).toHaveBeenCalledWith(template.id);
    });

    it("lists only the current version to a caller who may not edit the template", async () => {
      const current = createSummary({ version: 2 });
      const template = createTemplateRow({ currentVersionId: current.id });
      const { service, templateVersionRepository } = setup({ template });
      templateVersionRepository.listByTemplate.mockResolvedValue([current, createSummary({ templateId: template.id, version: 1 })]);

      const result = await service.listVersions(template.id);

      expect(result).toEqual([current]);
    });

    it("refuses an unreadable template with 404", async () => {
      const { service, templateVersionRepository } = setup({ template: undefined });

      await expect(service.listVersions(faker.string.uuid())).rejects.toMatchObject({ status: 404 });
      expect(templateVersionRepository.listByTemplate).not.toHaveBeenCalled();
    });
  });

  describe("getVersion", () => {
    it("reads the current version without its image digests", async () => {
      const version = createVersion({ version: 3, imageDigests: { "nginx:latest": "sha256:abc" } });
      const template = createTemplateRow({ currentVersionId: version.id });
      const { service, templateVersionRepository } = setup({ template });
      templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(version);

      const result = await service.getVersion(template.id, 3);

      const { imageDigests: _imageDigests, ...published } = version;
      expect(result).toEqual(published);
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
          updatedAt: editable.updatedAt,
          currentVersion: editable.currentVersion,
          lastEditedBy: { username: "alice" },
          canEdit: true
        },
        expect.objectContaining({ id: readOnly.id, currentVersion: null, lastEditedBy: null, canEdit: false })
      ]);
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
      changes: ["first_version"],
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
    const template = "template" in input ? input.template : createTemplateRow();
    repository.findReadable.mockResolvedValue(template);
    const templateVersionRepository = mock<TemplateVersionRepository>();
    templateVersionRepository.findById.mockResolvedValue("currentVersion" in input ? input.currentVersion : createVersion());
    const userTemplateRepository = mock<UserTemplateRepository>();
    userTemplateRepository.isFavorite.mockResolvedValue(false);
    const executionContextService = mock<ExecutionContextService>();
    const activeOrganizationId = input.activeOrganizationId === undefined ? faker.string.uuid() : input.activeOrganizationId;
    executionContextService.get
      .calledWith("ORGANIZATION_CONTEXT")
      .mockReturnValue(activeOrganizationId ? createOrganizationContext({ organizationId: activeOrganizationId }) : undefined);
    const service = new MarketplaceTemplateService(repository, templateVersionRepository, userTemplateRepository, authService, executionContextService);

    return { service, repository, readableRepository, templateVersionRepository, userTemplateRepository, ability, user };
  }
});
