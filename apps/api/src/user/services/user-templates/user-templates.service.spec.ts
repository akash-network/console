import { createMongoAbility, ForbiddenError, type MongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { TxService } from "@src/core/services";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { DeploymentProjectService } from "@src/deployment/services/deployment-project/deployment-project.service";
import { summarizeTemplateHardware } from "@src/template/utils/template-hardware/template-hardware";
import type { PublishCheckResults } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import type { TemplateVersionHoldReason } from "@src/template-marketplace/lib/version-hold/version-hold-reasons";
import type { TemplateRemovalRepository } from "@src/template-marketplace/repositories/template-removal/template-removal.repository";
import type { TemplateVersionOutput, TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type { PublishChecksService } from "@src/template-marketplace/services/publish-checks/publish-checks.service";
import type { TemplateRateLimiterService } from "@src/template-marketplace/services/template-rate-limiter/template-rate-limiter.service";
import type { TemplateImageDigestJobService } from "@src/template-marketplace/services/template-image-digest-job/template-image-digest-job.service";
import type { TemplateUsageService } from "@src/template-marketplace/services/template-usage/template-usage.service";
import type { TemplateVersionHoldService } from "@src/template-marketplace/services/template-version-hold/template-version-hold.service";
import type { UserOutput } from "@src/user/repositories";
import type { TemplateInput, TemplateOutput, TemplateVersionState, UserTemplateRepository } from "../../repositories/user-template/user-template.repository";
import { UserTemplatesService } from "./user-templates.service";

import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

const VALID_SDL = `
version: "2.0"
services:
  web:
    image: nginx
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 1
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 100
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

const PASSED_CHECKS: PublishCheckResults = { ranAt: "2026-11-18T10:00:00.000Z", checks: [{ key: "fixed_tags", status: "passed", issues: [] }] };
const FAILED_CHECKS: PublishCheckResults = {
  ranAt: "2026-11-18T10:00:00.000Z",
  checks: [{ key: "fixed_tags", status: "failed", issues: [{ message: "Pin the tag", service: "web", image: "nginx" }] }]
};

describe(UserTemplatesService.name, () => {
  describe("getTemplateById", () => {
    it("returns null when no template with that id is readable by an anonymous visitor", async () => {
      const { service, userTemplateRepository } = setup();
      const templateId = faker.string.uuid();

      userTemplateRepository.findById.mockResolvedValue(undefined);

      const result = await service.getTemplateById(templateId);

      expect(result).toBeNull();
      expect(userTemplateRepository.findById).toHaveBeenCalledWith(templateId, "");
    });

    it("returns null when the template is not readable by the requesting user", async () => {
      const { service, userTemplateRepository, ability } = setup();
      const templateId = faker.string.uuid();
      const requestingUserId = faker.string.uuid();

      userTemplateRepository.findById.mockResolvedValue(undefined);

      const result = await service.getTemplateById(templateId, requestingUserId);

      expect(result).toBeNull();
      expect(userTemplateRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(userTemplateRepository.findById).toHaveBeenCalledWith(templateId, requestingUserId);
      expect(userTemplateRepository.isFavorite).not.toHaveBeenCalled();
    });

    it("reads public templates only for a caller whose rules reach no template", async () => {
      const { service, userTemplateRepository } = setup({ canReadTemplates: false });
      const templateId = faker.string.uuid();

      userTemplateRepository.findById.mockResolvedValue(undefined);

      await service.getTemplateById(templateId, faker.string.uuid());

      expect(userTemplateRepository.accessibleBy).not.toHaveBeenCalled();
      expect(userTemplateRepository.findById).toHaveBeenCalledWith(templateId, "");
    });

    it("returns template without isFavorite when userId is not provided", async () => {
      const { service, userTemplateRepository } = setup();
      const templateId = faker.string.uuid();
      const template = createTemplateOutput({ id: templateId, isPublic: true });

      userTemplateRepository.findById.mockResolvedValue(template);

      const result = await service.getTemplateById(templateId);

      expect(result).toEqual(template);
      expect(userTemplateRepository.isFavorite).not.toHaveBeenCalled();
    });

    it("returns template with isFavorite when userId is provided", async () => {
      const { service, userTemplateRepository } = setup();
      const templateId = faker.string.uuid();
      const userId = faker.string.uuid();
      const template = createTemplateOutput({ id: templateId, isPublic: true });

      userTemplateRepository.findById.mockResolvedValue(template);
      userTemplateRepository.isFavorite.mockResolvedValue(true);

      const result = await service.getTemplateById(templateId, userId);

      expect(result).toEqual({ ...template, isFavorite: true });
      expect(userTemplateRepository.isFavorite).toHaveBeenCalledWith(templateId, userId);
    });

    it("returns private template when user is the owner", async () => {
      const { service, userTemplateRepository } = setup();
      const templateId = faker.string.uuid();
      const userId = faker.string.uuid();
      const template = createTemplateOutput({ id: templateId, userId, isPublic: false });

      userTemplateRepository.findById.mockResolvedValue(template);
      userTemplateRepository.isFavorite.mockResolvedValue(false);

      const result = await service.getTemplateById(templateId, userId);

      expect(result).toEqual({ ...template, isFavorite: false });
    });
  });

  describe("getTemplates", () => {
    it("returns templates by userId when userId is provided", async () => {
      const { service, userTemplateRepository, ability } = setup();
      const username = faker.internet.userName();
      const userId = faker.string.uuid();
      const templates = [createTemplateOutput(), createTemplateOutput()];

      userTemplateRepository.findAllByUserId.mockResolvedValue(templates);

      const result = await service.getTemplates(username, userId);

      expect(result).toEqual(templates);
      expect(userTemplateRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(userTemplateRepository.findAllByUserId).toHaveBeenCalledWith(userId);
      expect(userTemplateRepository.findAllByUsername).not.toHaveBeenCalled();
    });

    it("returns nothing to a signed-in caller whose rules reach no template", async () => {
      const { service, userTemplateRepository } = setup({ canReadTemplates: false });

      const result = await service.getTemplates(faker.internet.userName(), faker.string.uuid());

      expect(result).toEqual([]);
      expect(userTemplateRepository.findAllByUserId).not.toHaveBeenCalled();
      expect(userTemplateRepository.findAllByUsername).not.toHaveBeenCalled();
    });

    it("returns templates by username when userId is not provided", async () => {
      const { service, userTemplateRepository } = setup();
      const username = faker.internet.userName();
      const templates = [createTemplateOutput(), createTemplateOutput()];

      userTemplateRepository.findAllByUsername.mockResolvedValue(templates);

      const result = await service.getTemplates(username);

      expect(result).toEqual(templates);
      expect(userTemplateRepository.findAllByUsername).toHaveBeenCalledWith(username);
      expect(userTemplateRepository.findAllByUserId).not.toHaveBeenCalled();
    });
  });

  describe("saveTemplate", () => {
    it("changes the caller's own template under their update rules and leaves its project alone", async () => {
      const { service, userTemplateRepository, deploymentProjectService, ability } = setup();
      const id = faker.string.uuid();
      const userId = faker.string.uuid();
      const data = createTemplateInput();

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);

      const result = await service.saveTemplate(id, userId, { ...data, projectId: faker.string.uuid() });

      expect(result).toBe(id);
      expect(userTemplateRepository.isAuthoredBy).toHaveBeenCalledWith(id, userId);
      expect(userTemplateRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(userTemplateRepository.updateTemplate).toHaveBeenCalledWith(id, userId, data);
      expect(userTemplateRepository.createTemplate).not.toHaveBeenCalled();
      expect(deploymentProjectService.resolveFilingProject).not.toHaveBeenCalled();
    });

    describe("rate limits", () => {
      it("holds a new template to the create limits of the caller and the active organization while template_marketplace is on", async () => {
        const { service, userTemplateRepository, templateRateLimiterService, user, activeOrganizationId } = setup({ isMarketplaceOn: true });
        const refusal = new Error("too many templates");
        templateRateLimiterService.assertWithinLimits.mockRejectedValue(refusal);

        await expect(service.saveTemplate(undefined, faker.string.uuid(), { ...createTemplateInput(), isPublic: false })).rejects.toBe(refusal);

        expect(templateRateLimiterService.assertWithinLimits).toHaveBeenCalledWith("create", { userId: user.id, organizationId: activeOrganizationId });
        expect(userTemplateRepository.createTemplate).not.toHaveBeenCalled();
      });

      it("holds a new version to the version limits of the caller and the template's organization while template_marketplace is on", async () => {
        const { service, userTemplateRepository, templateVersionRepository, templateRateLimiterService, user } = setup({ isMarketplaceOn: true });
        const stored = createVersionState({ currentVersionId: faker.string.uuid(), currentVersionSdl: VALID_SDL });
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(stored);
        const refusal = new Error("too many versions");
        templateRateLimiterService.assertWithinLimits.mockRejectedValue(refusal);

        await expect(
          service.saveTemplate(faker.string.uuid(), faker.string.uuid(), { ...createTemplateInput(), isPublic: false, sdl: `${VALID_SDL}\n` })
        ).rejects.toBe(refusal);

        expect(templateRateLimiterService.assertWithinLimits).toHaveBeenCalledWith("version", { userId: user.id, organizationId: stored.organizationId });
        expect(userTemplateRepository.updateTemplate).not.toHaveBeenCalled();
        expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      });

      it("counts nothing against a save that keeps the current SDL", async () => {
        const { service, userTemplateRepository, templateRateLimiterService } = setup({ isMarketplaceOn: true });
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ currentVersionId: faker.string.uuid(), currentVersionSdl: VALID_SDL }));

        await service.saveTemplate(faker.string.uuid(), faker.string.uuid(), { ...createTemplateInput(), isPublic: false, sdl: VALID_SDL });

        expect(templateRateLimiterService.assertWithinLimits).not.toHaveBeenCalled();
        expect(userTemplateRepository.updateTemplate).toHaveBeenCalled();
      });

      it.each([
        { shape: "template_marketplace is off", options: { isMarketplaceOn: false } },
        { shape: "the request has no active organization", options: { isMarketplaceOn: true, hasNoOrganization: true } }
      ])("creates a template without consulting the limits when $shape", async ({ options }) => {
        const { service, userTemplateRepository, templateRateLimiterService } = setup(options);
        userTemplateRepository.createTemplate.mockResolvedValue(faker.string.uuid());

        await service.saveTemplate(undefined, faker.string.uuid(), { ...createTemplateInput(), isPublic: false });

        expect(templateRateLimiterService.assertWithinLimits).not.toHaveBeenCalled();
        expect(userTemplateRepository.createTemplate).toHaveBeenCalled();
      });

      it("saves a new version without consulting the limits while template_marketplace is off", async () => {
        const { service, userTemplateRepository, templateVersionRepository, templateRateLimiterService } = setup({ isMarketplaceOn: false });
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ currentVersionId: faker.string.uuid(), currentVersionSdl: VALID_SDL }));

        await service.saveTemplate(faker.string.uuid(), faker.string.uuid(), { ...createTemplateInput(), isPublic: false, sdl: `${VALID_SDL}\n` });

        expect(templateRateLimiterService.assertWithinLimits).not.toHaveBeenCalled();
        expect(templateVersionRepository.appendVersion).toHaveBeenCalled();
      });
    });

    it("refuses to create a public template outside the publish gate while template_marketplace is on", async () => {
      const { service, userTemplateRepository } = setup({ isMarketplaceOn: true });
      userTemplateRepository.isAuthoredBy.mockResolvedValue(false);

      await expect(service.saveTemplate(undefined, "user-id", { ...createTemplateInput(), isPublic: true })).rejects.toMatchObject({
        status: 409,
        errorCode: "template_publish_gate_required"
      });

      expect(userTemplateRepository.createTemplate).not.toHaveBeenCalled();
    });

    it("creates a template under the caller's create rules in the project resolved for templates", async () => {
      const { service, userTemplateRepository, deploymentProjectService, ability, user } = setup();
      const userId = faker.string.uuid();
      const [requestedProjectId, filingProjectId, newTemplateId] = [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()];
      const data = createTemplateInput();

      deploymentProjectService.resolveFilingProject.mockResolvedValue(filingProjectId);
      userTemplateRepository.createTemplate.mockResolvedValue(newTemplateId);

      const result = await service.saveTemplate(undefined, userId, { ...data, projectId: requestedProjectId });

      expect(result).toBe(newTemplateId);
      expect(userTemplateRepository.isAuthoredBy).not.toHaveBeenCalled();
      expect(userTemplateRepository.accessibleBy).toHaveBeenCalledWith(ability, "create");
      expect(deploymentProjectService.resolveFilingProject).toHaveBeenCalledWith(requestedProjectId, "Template");
      expect(userTemplateRepository.createTemplate).toHaveBeenCalledWith(userId, data, {
        projectId: filingProjectId,
        copiedFromId: undefined,
        authorId: user.id
      });
    });

    it("saves a template the caller did not author as a copy of it", async () => {
      const { service, userTemplateRepository, user } = setup();
      const id = faker.string.uuid();
      const userId = faker.string.uuid();
      const data = createTemplateInput();

      userTemplateRepository.isAuthoredBy.mockResolvedValue(false);

      await service.saveTemplate(id, userId, data);

      expect(userTemplateRepository.updateTemplate).not.toHaveBeenCalled();
      expect(userTemplateRepository.createTemplate).toHaveBeenCalledWith(userId, data, { projectId: undefined, copiedFromId: id, authorId: user.id });
    });

    it("records version 1 when it saves a new template", async () => {
      const { service, userTemplateRepository, templateVersionRepository, user } = setup();
      const templateId = faker.string.uuid();
      const data = { ...createTemplateInput(), sdl: VALID_SDL };

      userTemplateRepository.createTemplate.mockResolvedValue(templateId);

      await service.saveTemplate(undefined, user.userId!, data);

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith({
        templateId,
        sdl: data.sdl,
        resources: summarizeTemplateHardware(data.sdl),
        createdById: user.id
      });
    });

    it("records a new version when an update changes the sdl", async () => {
      const { service, userTemplateRepository, templateVersionRepository, user } = setup();
      const id = faker.string.uuid();
      const data = { ...createTemplateInput(), sdl: VALID_SDL };

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ currentVersionSdl: "version: '2.0'" }));

      await service.saveTemplate(id, user.userId!, data);

      expect(userTemplateRepository.findVersionState).toHaveBeenCalledWith(id, user.userId);
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith({
        templateId: id,
        sdl: data.sdl,
        resources: summarizeTemplateHardware(data.sdl),
        createdById: user.id,
        readmesShown: { current: null, next: data.description }
      });
    });

    it("tells the readme change between the descriptions a version without a readme shows", async () => {
      const { service, userTemplateRepository, templateVersionRepository, user } = setup();
      const data = { ...createTemplateInput(), description: "# New" };

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ description: "# Old", currentVersionReadme: null }));

      await service.saveTemplate(faker.string.uuid(), user.userId!, data);

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ readmesShown: { current: "# Old", next: "# New" } }));
    });

    it("keeps the stored description as the readme shown when a save sends none", async () => {
      const { service, userTemplateRepository, templateVersionRepository, user } = setup();
      const data = { ...createTemplateInput(), description: undefined };

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ description: "# Kept", currentVersionReadme: null }));

      await service.saveTemplate(faker.string.uuid(), user.userId!, data);

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ readmesShown: { current: "# Kept", next: "# Kept" } }));
    });

    it("takes the description a save sends as the readme of a version that carries one", async () => {
      const { service, userTemplateRepository, templateVersionRepository, user } = setup();
      const data = { ...createTemplateInput(), description: "# New" };

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ description: "# Old", currentVersionReadme: "# Old" }));

      await service.saveTemplate(faker.string.uuid(), user.userId!, data);

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(
        expect.objectContaining({ readme: "# New", askedValues: [], readmesShown: { current: "# Old", next: "# New" } })
      );
    });

    it("records no version when an update keeps the sdl", async () => {
      const { service, userTemplateRepository, templateVersionRepository, user } = setup();
      const data = createTemplateInput();

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ currentVersionSdl: data.sdl }));

      await service.saveTemplate(faker.string.uuid(), user.userId!, data);

      expect(userTemplateRepository.updateTemplate).toHaveBeenCalled();
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
    });

    it("records version 1 when it updates a template that has none", async () => {
      const { service, userTemplateRepository, templateVersionRepository, user } = setup();
      const id = faker.string.uuid();
      const data = createTemplateInput();

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ currentVersionSdl: null, currentVersionId: null }));

      await service.saveTemplate(id, user.userId!, data);

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith({
        templateId: id,
        sdl: data.sdl,
        resources: summarizeTemplateHardware(data.sdl),
        createdById: user.id,
        readmesShown: { current: null, next: data.description }
      });
    });

    it("sends isPublic along when an update changes it", async () => {
      const { service, userTemplateRepository, user } = setup();
      const id = faker.string.uuid();
      const data = { ...createTemplateInput(), isPublic: true };

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ currentVersionSdl: data.sdl }));

      await service.saveTemplate(id, user.userId!, data);

      expect(userTemplateRepository.updateTemplate).toHaveBeenCalledWith(id, user.userId, data);
    });

    it("leaves isPublic out of an update that keeps it", async () => {
      const { service, userTemplateRepository, user } = setup();
      const id = faker.string.uuid();
      const { isPublic, ...rest } = { ...createTemplateInput(), isPublic: true };

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ isPublic, visibility: "public", currentVersionSdl: rest.sdl }));

      await service.saveTemplate(id, user.userId!, { ...rest, isPublic });

      expect(userTemplateRepository.updateTemplate).toHaveBeenCalledWith(id, user.userId, rest);
    });

    it("keeps an organization template out of an update that keeps isPublic", async () => {
      const { service, userTemplateRepository, user } = setup();
      const id = faker.string.uuid();
      const { isPublic, ...rest } = { ...createTemplateInput(), isPublic: false };

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ isPublic, visibility: "organization", currentVersionSdl: rest.sdl }));

      await service.saveTemplate(id, user.userId!, { ...rest, isPublic });

      expect(userTemplateRepository.updateTemplate).toHaveBeenCalledWith(id, user.userId, rest);
    });

    it("sends the unchanged isPublic along when the stored visibility disagrees with it", async () => {
      const { service, userTemplateRepository, user } = setup();
      const id = faker.string.uuid();
      const data = { ...createTemplateInput(), isPublic: false };

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ isPublic: false, visibility: "public", currentVersionSdl: data.sdl }));

      await service.saveTemplate(id, user.userId!, data);

      expect(userTemplateRepository.updateTemplate).toHaveBeenCalledWith(id, user.userId, data);
    });

    it("sends the stored isPublic when the stored visibility disagrees with it and the save names none", async () => {
      const { service, userTemplateRepository, user } = setup();
      const id = faker.string.uuid();
      const { isPublic: _isPublic, ...rest } = createTemplateInput();

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ isPublic: true, visibility: "private", currentVersionSdl: rest.sdl }));

      await service.saveTemplate(id, user.userId!, rest);

      expect(userTemplateRepository.updateTemplate).toHaveBeenCalledWith(id, user.userId, { ...rest, isPublic: true });
    });

    it("answers 404 and records nothing when the template disappears before the update", async () => {
      const { service, userTemplateRepository, templateVersionRepository, user } = setup();

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(undefined);

      await expect(service.saveTemplate(faker.string.uuid(), user.userId!, createTemplateInput())).rejects.toMatchObject({ status: 404 });
      expect(userTemplateRepository.updateTemplate).not.toHaveBeenCalled();
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
    });

    it("records no version when saving the template fails", async () => {
      const { service, userTemplateRepository, templateVersionRepository, user } = setup();

      userTemplateRepository.createTemplate.mockRejectedValue(new Error("insert failed"));

      await expect(service.saveTemplate(undefined, user.userId!, createTemplateInput())).rejects.toThrow("insert failed");
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
    });

    it("saves the template and its version in one transaction", async () => {
      const { service, userTemplateRepository, templateVersionRepository, txService, user } = setup();
      const order: string[] = [];

      txService.transaction.mockImplementation(async cb => {
        order.push("begin");
        const result = await cb();
        order.push("commit");
        return result;
      });
      userTemplateRepository.createTemplate.mockImplementation(async () => {
        order.push("createTemplate");
        return faker.string.uuid();
      });
      templateVersionRepository.appendVersion.mockImplementation(async () => {
        order.push("appendVersion");
        return mock();
      });

      await service.saveTemplate(undefined, user.userId!, createTemplateInput());

      expect(order).toEqual(["begin", "createTemplate", "appendVersion", "commit"]);
    });

    it("refuses a caller who may create no template before resolving a project", async () => {
      const { service, userTemplateRepository, deploymentProjectService } = setup();

      userTemplateRepository.accessibleBy.mockImplementation(() => {
        throw new ForbiddenError(createMongoAbility());
      });

      await expect(service.saveTemplate(undefined, faker.string.uuid(), createTemplateInput())).rejects.toBeInstanceOf(ForbiddenError);
      expect(deploymentProjectService.resolveFilingProject).not.toHaveBeenCalled();
    });

    describe("when the template went through the publish gate", () => {
      it("refuses a save that fails the publish checks and writes nothing", async () => {
        const { service, userTemplateRepository, templateVersionRepository, publishChecksService } = setup({
          isMarketplaceOn: true,
          checkResults: FAILED_CHECKS
        });
        const stored = createVersionState({
          visibility: "public",
          isPublic: true,
          publishedAt: new Date(),
          summary: "A stored summary",
          currentVersionAskedValues: []
        });
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(stored);
        const template = createTemplateInput();

        await expect(service.saveTemplate("template-id", "user-id", template)).rejects.toMatchObject({
          status: 400,
          errorCode: "template_publish_checks_failed",
          data: { checks: FAILED_CHECKS.checks }
        });

        expect(publishChecksService.run).toHaveBeenCalledWith({
          sdl: template.sdl,
          readme: template.description,
          askedValues: [],
          title: template.title,
          summary: "A stored summary",
          organizationId: stored.organizationId
        });
        expect(userTemplateRepository.updateTemplate).not.toHaveBeenCalled();
        expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      });

      it("saves a new version that passes the publish checks", async () => {
        const { service, userTemplateRepository, templateVersionRepository } = setup({ isMarketplaceOn: true });
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ visibility: "public", isPublic: true, publishedAt: new Date() }));

        await service.saveTemplate("template-id", "user-id", createTemplateInput());

        expect(userTemplateRepository.updateTemplate).toHaveBeenCalledTimes(1);
        expect(templateVersionRepository.appendVersion).toHaveBeenCalledTimes(1);
        expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ checkResults: PASSED_CHECKS }));
      });

      it("checks the README of the current version on a save that keeps the SDL", async () => {
        const { service, userTemplateRepository, publishChecksService } = setup({ isMarketplaceOn: true });
        const template = createTemplateInput();
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(
          createVersionState({
            visibility: "public",
            isPublic: true,
            publishedAt: new Date(),
            currentVersionSdl: template.sdl,
            currentVersionReadme: "# Stored"
          })
        );

        await service.saveTemplate("template-id", "user-id", template);

        expect(publishChecksService.run).toHaveBeenCalledWith(expect.objectContaining({ readme: "# Stored" }));
      });

      it.each([
        { shape: "a template taken out of the gallery", stored: { visibility: "private" as const, isPublic: false, publishedAt: new Date() } },
        { shape: "a template that never went through the gate", stored: { visibility: "private" as const, isPublic: false, publishedAt: null } },
        { shape: "a template shared with its organization", stored: { visibility: "organization" as const, isPublic: false, publishedAt: null } }
      ])("refuses to make $shape public outside the publish gate and writes nothing", async ({ stored }) => {
        const { service, userTemplateRepository, templateVersionRepository, publishChecksService } = setup({ isMarketplaceOn: true });
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(createVersionState(stored));

        await expect(service.saveTemplate("template-id", "user-id", { ...createTemplateInput(), isPublic: true })).rejects.toMatchObject({
          status: 409,
          errorCode: "template_publish_gate_required"
        });

        expect(publishChecksService.run).not.toHaveBeenCalled();
        expect(userTemplateRepository.updateTemplate).not.toHaveBeenCalled();
        expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      });

      it("keeps saving a template shared with its organization that stays out of the gallery", async () => {
        const { service, userTemplateRepository, templateVersionRepository, publishChecksService } = setup({
          isMarketplaceOn: true,
          checkResults: FAILED_CHECKS
        });
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ visibility: "organization", isPublic: false, publishedAt: new Date() }));
        const { isPublic: _isPublic, ...template } = createTemplateInput();

        await service.saveTemplate("template-id", "user-id", template);

        expect(publishChecksService.run).not.toHaveBeenCalled();
        expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ checkResults: undefined }));
      });

      it("checks a save that keeps the SDL under the asked values of the current version", async () => {
        const { service, userTemplateRepository, publishChecksService } = setup({ isMarketplaceOn: true });
        const template = createTemplateInput();
        const askedValues = [{ key: "PORT", label: "Port", type: "text" as const, required: false, bindings: [{ service: "web", env: "PORT" }] }];
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(
          createVersionState({
            visibility: "public",
            isPublic: true,
            publishedAt: new Date(),
            currentVersionSdl: template.sdl,
            currentVersionAskedValues: askedValues
          })
        );

        await service.saveTemplate("template-id", "user-id", template);

        expect(publishChecksService.run).toHaveBeenCalledWith(expect.objectContaining({ askedValues }));
      });

      it("checks a save that keeps the SDL under the readme the current version keeps showing", async () => {
        const { service, userTemplateRepository, publishChecksService } = setup({ isMarketplaceOn: true });
        const template = createTemplateInput();
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(
          createVersionState({
            visibility: "public",
            isPublic: true,
            publishedAt: new Date(),
            currentVersionSdl: template.sdl,
            currentVersionReadme: "# Kept readme"
          })
        );

        await service.saveTemplate("template-id", "user-id", template);

        expect(publishChecksService.run).toHaveBeenCalledWith(expect.objectContaining({ readme: "# Kept readme" }));
      });

      it("checks a new version under the description it carries as its readme", async () => {
        const { service, userTemplateRepository, publishChecksService } = setup({ isMarketplaceOn: true });
        const template = { ...createTemplateInput(), description: "A new description" };
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(
          createVersionState({ visibility: "public", isPublic: true, publishedAt: new Date(), currentVersionReadme: "# Old readme" })
        );

        await service.saveTemplate("template-id", "user-id", template);

        expect(publishChecksService.run).toHaveBeenCalledWith(expect.objectContaining({ readme: "A new description" }));
      });

      it("checks the stored description as the readme of a save that sends none", async () => {
        const { service, userTemplateRepository, publishChecksService } = setup({ isMarketplaceOn: true });
        const { description: _description, ...template } = createTemplateInput();
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(
          createVersionState({ visibility: "public", isPublic: true, publishedAt: new Date(), description: "A stored description" })
        );

        await service.saveTemplate("template-id", "user-id", template);

        expect(publishChecksService.run).toHaveBeenCalledWith(expect.objectContaining({ readme: "A stored description" }));
      });

      it.each([
        {
          shape: "template_marketplace is off",
          isMarketplaceOn: false,
          isPublic: true,
          stored: { visibility: "public" as const, isPublic: true, publishedAt: new Date() }
        },
        {
          shape: "template_marketplace is off and the save makes the template public again",
          isMarketplaceOn: false,
          isPublic: true,
          stored: { visibility: "private" as const, isPublic: false, publishedAt: new Date() }
        },
        {
          shape: "the template never went through the gate",
          isMarketplaceOn: true,
          isPublic: true,
          stored: { visibility: "public" as const, isPublic: true, publishedAt: null }
        },
        {
          shape: "template_marketplace is off and a template that never went through the gate is made public",
          isMarketplaceOn: false,
          isPublic: true,
          stored: { visibility: "private" as const, isPublic: false, publishedAt: null }
        },
        {
          shape: "the template is no longer public and stays private",
          isMarketplaceOn: true,
          isPublic: false,
          stored: { visibility: "private" as const, isPublic: false, publishedAt: new Date() }
        }
      ])("runs no publish check when $shape", async ({ isMarketplaceOn, isPublic, stored }) => {
        const { service, userTemplateRepository, templateVersionRepository, publishChecksService } = setup({ isMarketplaceOn, checkResults: FAILED_CHECKS });
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(createVersionState(stored));

        await service.saveTemplate("template-id", "user-id", { ...createTemplateInput(), isPublic });

        expect(publishChecksService.run).not.toHaveBeenCalled();
        expect(templateVersionRepository.appendVersion).toHaveBeenCalledTimes(1);
      });

      it("runs no publish check on a save that makes the template private", async () => {
        const { service, userTemplateRepository, publishChecksService } = setup({ isMarketplaceOn: true, checkResults: FAILED_CHECKS });
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ visibility: "public", isPublic: true, publishedAt: new Date() }));

        await service.saveTemplate("template-id", "user-id", { ...createTemplateInput(), isPublic: false });

        expect(publishChecksService.run).not.toHaveBeenCalled();
        expect(userTemplateRepository.updateTemplate).toHaveBeenCalledTimes(1);
      });

      it("checks a save that leaves the public flag unnamed", async () => {
        const { service, userTemplateRepository, publishChecksService } = setup({ isMarketplaceOn: true });
        userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
        userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ visibility: "public", isPublic: true, publishedAt: new Date() }));
        const { isPublic: _isPublic, ...template } = createTemplateInput();

        await service.saveTemplate("template-id", "user-id", template);

        expect(publishChecksService.run).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("when a save would need staff review", () => {
    const HOLD_REASONS: TemplateVersionHoldReason[] = [{ kind: "official_template", message: "Official templates are always reviewed." }];

    it("refuses a new version of a public template that would wait for staff, and writes nothing", async () => {
      const { service, userTemplateRepository, templateVersionRepository, templateVersionHoldService } = setup({
        isMarketplaceOn: true,
        holdReasons: HOLD_REASONS
      });
      const stored = createVersionState({ visibility: "public", isPublic: true, isOfficial: true, currentVersionSdl: "version: '2.0'" });
      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(stored);
      const data = { ...createTemplateInput(), sdl: VALID_SDL };

      const error = await service.saveTemplate("template-id", "user-id", data).catch((rejection: unknown) => rejection);

      expect(error).toMatchObject({ status: 409, errorCode: "template_version_review_required", data: { holdReasons: HOLD_REASONS } });
      expect(templateVersionHoldService.findHoldReasons).toHaveBeenCalledWith(
        { id: "template-id", organizationId: stored.organizationId, isOfficial: true },
        "version: '2.0'",
        VALID_SDL
      );
      expect(userTemplateRepository.updateTemplate).not.toHaveBeenCalled();
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
    });

    it("judges a public template that has no version yet against an empty SDL", async () => {
      const { service, userTemplateRepository, templateVersionHoldService } = setup({ isMarketplaceOn: true });
      const stored = createVersionState({ visibility: "public", isPublic: true, currentVersionId: null, currentVersionSdl: null });
      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(stored);
      const data = createTemplateInput();

      await service.saveTemplate("template-id", "user-id", data);

      expect(templateVersionHoldService.findHoldReasons).toHaveBeenCalledWith(expect.objectContaining({ isOfficial: false }), "", data.sdl);
    });

    it("saves a new version of a public template that needs no review", async () => {
      const { service, userTemplateRepository, templateVersionRepository } = setup({ isMarketplaceOn: true });
      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ visibility: "public", isPublic: true }));

      await service.saveTemplate("template-id", "user-id", createTemplateInput());

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledTimes(1);
    });

    it.each([
      {
        name: "the marketplace is off",
        isMarketplaceOn: false,
        stored: { visibility: "public" as const, isPublic: true },
        isPublic: undefined,
        keepsSdl: false
      },
      {
        name: "the template is private",
        isMarketplaceOn: true,
        stored: { visibility: "private" as const, isPublic: false },
        isPublic: undefined,
        keepsSdl: false
      },
      {
        name: "the template is shared with its organization",
        isMarketplaceOn: true,
        stored: { visibility: "organization" as const },
        isPublic: undefined,
        keepsSdl: false
      },
      {
        name: "the save makes the template private",
        isMarketplaceOn: true,
        stored: { visibility: "public" as const, isPublic: true },
        isPublic: false,
        keepsSdl: false
      },
      { name: "the save keeps the SDL", isMarketplaceOn: true, stored: { visibility: "public" as const, isPublic: true }, isPublic: undefined, keepsSdl: true }
    ])("asks for no review when $name", async ({ isMarketplaceOn, stored, isPublic, keepsSdl }) => {
      const { service, userTemplateRepository, templateVersionHoldService } = setup({ isMarketplaceOn, holdReasons: HOLD_REASONS });
      const data = { ...createTemplateInput(), isPublic };
      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ ...stored, ...(keepsSdl && { currentVersionSdl: data.sdl }) }));

      await service.saveTemplate("template-id", "user-id", data);

      expect(templateVersionHoldService.findHoldReasons).not.toHaveBeenCalled();
      expect(userTemplateRepository.updateTemplate).toHaveBeenCalledTimes(1);
    });
  });

  describe("image digests", () => {
    it("queues the digests of a new template's first version and of a new version while template_marketplace is on", async () => {
      const { service, userTemplateRepository, templateImageDigestJobService, appendedVersion, user } = setup({ isMarketplaceOn: true });
      userTemplateRepository.createTemplate.mockResolvedValue(faker.string.uuid());

      await service.saveTemplate(undefined, user.userId!, { ...createTemplateInput(), sdl: VALID_SDL, isPublic: false });

      expect(templateImageDigestJobService.schedule).toHaveBeenCalledTimes(1);
      expect(templateImageDigestJobService.schedule).toHaveBeenLastCalledWith(appendedVersion.id);

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      await service.saveTemplate("template-id", user.userId!, { ...createTemplateInput(), isPublic: false });

      expect(templateImageDigestJobService.schedule).toHaveBeenCalledTimes(2);
      expect(templateImageDigestJobService.schedule).toHaveBeenLastCalledWith(appendedVersion.id);
    });

    it("reaches for no registry while template_marketplace is off, or when a save records no version", async () => {
      const off = setup({ isMarketplaceOn: false });
      off.userTemplateRepository.createTemplate.mockResolvedValue(faker.string.uuid());
      await off.service.saveTemplate(undefined, off.user.userId!, { ...createTemplateInput(), sdl: VALID_SDL });
      off.userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      await off.service.saveTemplate("template-id", off.user.userId!, createTemplateInput());

      const sameSdl = setup({ isMarketplaceOn: true });
      const data = { ...createTemplateInput(), isPublic: false };
      sameSdl.userTemplateRepository.isAuthoredBy.mockResolvedValue(true);
      sameSdl.userTemplateRepository.findVersionState.mockResolvedValue(createVersionState({ currentVersionSdl: data.sdl }));
      await sameSdl.service.saveTemplate("template-id", sameSdl.user.userId!, data);

      expect(off.templateVersionRepository.appendVersion).toHaveBeenCalledTimes(2);
      expect(off.templateImageDigestJobService.schedule).not.toHaveBeenCalled();
      expect(sameSdl.templateImageDigestJobService.schedule).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("calls repository updateById with correct parameters", async () => {
      const { service, userTemplateRepository, ability } = setup();
      const id = faker.string.uuid();
      const userId = faker.string.uuid();
      const data: Partial<TemplateInput> = {
        title: faker.lorem.words(3),
        description: faker.lorem.sentence()
      };

      userTemplateRepository.updateTemplate.mockResolvedValue();

      await service.update(id, userId, data);

      expect(userTemplateRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(userTemplateRepository.updateTemplate).toHaveBeenCalledWith(id, userId, data);
    });

    it("refuses a description holding a provider key when a published template shows it as its README", async () => {
      const { service, userTemplateRepository } = setup({ isMarketplaceOn: true });
      userTemplateRepository.findVersionState.mockResolvedValue(
        createVersionState({ visibility: "public", isPublic: true, publishedAt: new Date(), currentVersionReadme: null })
      );

      await expect(service.update("template-id", "user-id", { description: "Run it with hf_abcdefghijklmnopqrstuv" })).rejects.toMatchObject({
        status: 400,
        errorCode: "template_publish_checks_failed",
        data: { checks: [{ key: "no_secrets", status: "failed", issues: [expect.objectContaining({ field: "readme" })] }] }
      });

      expect(userTemplateRepository.updateTemplate).not.toHaveBeenCalled();
    });

    it.each([
      {
        shape: "template_marketplace is off",
        isMarketplaceOn: false,
        stored: { visibility: "public" as const, publishedAt: new Date(), currentVersionReadme: null }
      },
      {
        shape: "the template is private",
        isMarketplaceOn: true,
        stored: { visibility: "private" as const, publishedAt: new Date(), currentVersionReadme: null }
      },
      {
        shape: "the template never went through the gate",
        isMarketplaceOn: true,
        stored: { visibility: "public" as const, publishedAt: null, currentVersionReadme: null }
      },
      {
        shape: "the version has a README of its own",
        isMarketplaceOn: true,
        stored: { visibility: "public" as const, publishedAt: new Date(), currentVersionReadme: "# Mine" }
      }
    ])("saves any description when $shape", async ({ isMarketplaceOn, stored }) => {
      const { service, userTemplateRepository } = setup({ isMarketplaceOn });
      userTemplateRepository.findVersionState.mockResolvedValue(createVersionState(stored));
      const data = { description: "Run it with hf_abcdefghijklmnopqrstuv" };

      await service.update("template-id", "user-id", data);

      expect(userTemplateRepository.updateTemplate).toHaveBeenCalledWith("template-id", "user-id", data);
    });

    it("saves an ordinary description of a published template, and a change that leaves the description alone", async () => {
      const { service, userTemplateRepository } = setup({ isMarketplaceOn: true });
      userTemplateRepository.findVersionState.mockResolvedValue(
        createVersionState({ visibility: "public", isPublic: true, publishedAt: new Date(), currentVersionReadme: null })
      );

      await service.update("template-id", "user-id", { description: "Chat with your own models." });
      await service.update("template-id", "user-id", { title: "Renamed" });

      expect(userTemplateRepository.updateTemplate).toHaveBeenCalledTimes(2);
    });
  });

  describe("deleteTemplate", () => {
    it("deletes a template that was never public, within the caller's delete rules", async () => {
      const { service, userTemplateRepository, templateRemovalRepository, txService, ability } = setup();
      const userId = faker.string.uuid();
      const id = faker.string.uuid();
      userTemplateRepository.markRemovedIfEverPublic.mockResolvedValue(false);

      await service.deleteTemplate(userId, id);

      expect(userTemplateRepository.accessibleBy).toHaveBeenCalledWith(ability, "delete");
      expect(userTemplateRepository.markRemovedIfEverPublic).toHaveBeenCalledWith(id, userId);
      expect(userTemplateRepository.deleteById).toHaveBeenCalledWith(id, userId);
      expect(templateRemovalRepository.emptyRemoved).not.toHaveBeenCalled();
      expect(txService.transaction).toHaveBeenCalledTimes(1);
    });

    it("empties a once-public template it marked removed instead of deleting it", async () => {
      const { service, userTemplateRepository, templateRemovalRepository } = setup();
      const userId = faker.string.uuid();
      const id = faker.string.uuid();
      userTemplateRepository.markRemovedIfEverPublic.mockResolvedValue(true);

      await service.deleteTemplate(userId, id);

      expect(templateRemovalRepository.emptyRemoved).toHaveBeenCalledWith(id, "owner");
      expect(userTemplateRepository.deleteById).not.toHaveBeenCalled();
    });
  });

  describe("getFavoriteTemplates", () => {
    it("returns mapped favorite templates with id, title, and description", async () => {
      const { service, userTemplateRepository } = setup();
      const userId = faker.string.uuid();
      const templates = [
        createTemplateOutput({ id: "1", title: "Template 1", description: "Desc 1" }),
        createTemplateOutput({ id: "2", title: "Template 2", description: "Desc 2" })
      ];

      userTemplateRepository.getFavoriteTemplates.mockResolvedValue(templates);

      const result = await service.getFavoriteTemplates(userId);

      expect(result).toEqual([
        { id: "1", title: "Template 1", description: "Desc 1" },
        { id: "2", title: "Template 2", description: "Desc 2" }
      ]);
      expect(userTemplateRepository.getFavoriteTemplates).toHaveBeenCalledWith(userId, userId);
    });

    it("leaves private favorites out for a caller whose rules reach no template", async () => {
      const { service, userTemplateRepository } = setup({ canReadTemplates: false });
      const userId = faker.string.uuid();

      userTemplateRepository.getFavoriteTemplates.mockResolvedValue([]);

      await service.getFavoriteTemplates(userId);

      expect(userTemplateRepository.accessibleBy).not.toHaveBeenCalled();
      expect(userTemplateRepository.getFavoriteTemplates).toHaveBeenCalledWith(userId, "");
    });

    it("returns empty array when no favorites exist", async () => {
      const { service, userTemplateRepository } = setup();
      const userId = faker.string.uuid();

      userTemplateRepository.getFavoriteTemplates.mockResolvedValue([]);

      const result = await service.getFavoriteTemplates(userId);

      expect(result).toEqual([]);
    });
  });

  describe("addFavoriteTemplate", () => {
    it("calls repository addFavorite with correct parameters", async () => {
      const { service, userTemplateRepository } = setup();
      const userId = faker.string.uuid();
      const templateId = faker.string.uuid();

      userTemplateRepository.addFavorite.mockResolvedValue(true);

      await service.addFavoriteTemplate(userId, templateId);

      expect(userTemplateRepository.addFavorite).toHaveBeenCalledWith(userId, templateId, userId);
    });

    it("marks only a public template as favorite for a caller whose rules reach no template", async () => {
      const { service, userTemplateRepository } = setup({ canReadTemplates: false });
      const userId = faker.string.uuid();
      const templateId = faker.string.uuid();

      await service.addFavoriteTemplate(userId, templateId);

      expect(userTemplateRepository.addFavorite).toHaveBeenCalledWith(userId, templateId, "");
    });
  });

  describe("removeFavoriteTemplate", () => {
    it("calls repository removeFavorite with correct parameters", async () => {
      const { service, userTemplateRepository } = setup();
      const userId = faker.string.uuid();
      const templateId = faker.string.uuid();

      userTemplateRepository.removeFavorite.mockResolvedValue(true);

      await service.removeFavoriteTemplate(userId, templateId);

      expect(userTemplateRepository.removeFavorite).toHaveBeenCalledWith(userId, templateId);
    });
  });

  describe("when favorites change", () => {
    it("records a favorite only when it was added", async () => {
      const { service, userTemplateRepository, templateUsageService } = setup();
      const templateId = faker.string.uuid();
      userTemplateRepository.addFavorite.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await service.addFavoriteTemplate(faker.string.uuid(), templateId);
      await service.addFavoriteTemplate(faker.string.uuid(), templateId);

      expect(templateUsageService.recordFavorite).toHaveBeenCalledTimes(1);
      expect(templateUsageService.recordFavorite).toHaveBeenCalledWith(templateId, "favorite");
    });

    it("records an unfavorite only when one was removed", async () => {
      const { service, userTemplateRepository, templateUsageService } = setup();
      const templateId = faker.string.uuid();
      userTemplateRepository.removeFavorite.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await service.removeFavoriteTemplate(faker.string.uuid(), templateId);
      await service.removeFavoriteTemplate(faker.string.uuid(), templateId);

      expect(templateUsageService.recordFavorite).toHaveBeenCalledTimes(1);
      expect(templateUsageService.recordFavorite).toHaveBeenCalledWith(templateId, "unfavorite");
    });

    it("answers the favorite routes without a value and with the legacy repository arguments", async () => {
      const { service, userTemplateRepository, templateUsageService } = setup();
      const userId = faker.string.uuid();
      const templateId = faker.string.uuid();
      userTemplateRepository.addFavorite.mockResolvedValue(true);
      userTemplateRepository.removeFavorite.mockResolvedValue(true);
      templateUsageService.recordFavorite.mockResolvedValue();

      const answers = [await service.addFavoriteTemplate(userId, templateId), await service.removeFavoriteTemplate(userId, templateId)];

      expect(answers).toEqual([undefined, undefined]);
      expect(userTemplateRepository.addFavorite).toHaveBeenCalledWith(userId, templateId, userId);
      expect(userTemplateRepository.removeFavorite).toHaveBeenCalledWith(userId, templateId);
    });
  });

  function setup(
    input: {
      canReadTemplates?: boolean;
      isMarketplaceOn?: boolean;
      checkResults?: PublishCheckResults;
      hasNoOrganization?: boolean;
      holdReasons?: TemplateVersionHoldReason[];
    } = {}
  ) {
    const ability = createMongoAbility<MongoAbility>(input.canReadTemplates === false ? [] : [{ action: "read", subject: "Template" }]);
    const userTemplateRepository: MockProxy<UserTemplateRepository> = mock<UserTemplateRepository>();
    userTemplateRepository.accessibleBy.mockReturnValue(userTemplateRepository);
    const authService = mock<AuthService>();
    authService.ability = ability;
    const deploymentProjectService = mock<DeploymentProjectService>();
    const user = mock<UserOutput>({ id: faker.string.uuid(), userId: faker.string.uuid() });
    authService.currentUser = user;
    const templateVersionRepository = mock<TemplateVersionRepository>();
    const appendedVersion = mock<TemplateVersionOutput>({ id: faker.string.uuid() });
    templateVersionRepository.appendVersion.mockResolvedValue(appendedVersion);
    userTemplateRepository.findVersionState.mockResolvedValue(createVersionState());
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const templateUsageService = mock<TemplateUsageService>();
    const publishChecksService = mock<PublishChecksService>();
    publishChecksService.run.mockResolvedValue(input.checkResults ?? PASSED_CHECKS);
    const featureFlagsService = mock<FeatureFlagsService>();
    featureFlagsService.isEnabled.mockImplementation(flag => flag === FeatureFlags.TEMPLATE_MARKETPLACE && !!input.isMarketplaceOn);
    const templateRateLimiterService = mock<TemplateRateLimiterService>();
    const activeOrganizationId = faker.string.uuid();
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get
      .calledWith("ORGANIZATION_CONTEXT")
      .mockReturnValue(input.hasNoOrganization ? undefined : createOrganizationContext({ organizationId: activeOrganizationId }));
    const templateRemovalRepository = mock<TemplateRemovalRepository>();
    const templateVersionHoldService = mock<TemplateVersionHoldService>();
    templateVersionHoldService.findHoldReasons.mockResolvedValue(input.holdReasons ?? []);
    const templateImageDigestJobService = mock<TemplateImageDigestJobService>();
    const service = new UserTemplatesService(
      userTemplateRepository,
      authService,
      deploymentProjectService,
      templateVersionRepository,
      txService,
      templateUsageService,
      publishChecksService,
      featureFlagsService,
      templateRateLimiterService,
      executionContextService,
      templateRemovalRepository,
      templateVersionHoldService,
      templateImageDigestJobService
    );

    return {
      service,
      userTemplateRepository,
      deploymentProjectService,
      templateVersionRepository,
      txService,
      user,
      ability,
      templateUsageService,
      publishChecksService,
      templateRateLimiterService,
      activeOrganizationId,
      templateRemovalRepository,
      templateVersionHoldService,
      templateImageDigestJobService,
      appendedVersion
    };
  }

  function createVersionState(overrides: Partial<TemplateVersionState> = {}): TemplateVersionState {
    return {
      organizationId: faker.string.uuid(),
      isOfficial: false,
      isPublic: false,
      visibility: "private",
      publishedAt: null,
      summary: null,
      description: null,
      currentVersionId: faker.string.uuid(),
      currentVersionSdl: faker.lorem.paragraph(),
      ...overrides
    };
  }

  function createTemplateInput(): TemplateInput {
    return {
      sdl: faker.lorem.paragraph(),
      title: faker.lorem.words(3),
      cpu: faker.number.int({ min: 1, max: 8 }),
      ram: faker.number.int({ min: 512, max: 8192 }),
      storage: faker.number.int({ min: 1, max: 100 }),
      isPublic: true,
      description: faker.lorem.sentence()
    };
  }

  function createTemplateOutput(overrides?: Partial<TemplateOutput>): TemplateOutput {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      title: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      cpu: faker.number.int({ min: 1, max: 8 }),
      ram: faker.number.int({ min: 512, max: 8192 }),
      storage: faker.number.int({ min: 1, max: 100 }),
      sdl: faker.lorem.paragraph(),
      username: faker.internet.userName(),
      isPublic: faker.datatype.boolean(),
      ...overrides
    };
  }
});
