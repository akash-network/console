import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { BillingConfig } from "@src/billing/providers";
import type { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import type { CreateLogger } from "@src/core";
import type { TxService } from "@src/core/services";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import type { DeploymentProjectService } from "@src/deployment/services/deployment-project/deployment-project.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { EXPANDED_SDL_TOO_LARGE_MESSAGE } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import type { PublishCheckResults } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import type { TemplateVersionHoldReason } from "@src/template-marketplace/lib/version-hold/version-hold-reasons";
import type {
  MarketplaceTemplateRepository,
  MarketplaceTemplateRow
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import type { TemplateRemovalRepository } from "@src/template-marketplace/repositories/template-removal/template-removal.repository";
import type { TemplateVersionOutput, TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type {
  MarketplaceTemplateOutput,
  MarketplaceTemplateService
} from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import type { PublishChecksService } from "@src/template-marketplace/services/publish-checks/publish-checks.service";
import type { TemplateImageDigestJobService } from "@src/template-marketplace/services/template-image-digest-job/template-image-digest-job.service";
import type { TemplatePublisherNotifierService } from "@src/template-marketplace/services/template-publisher-notifier/template-publisher-notifier.service";
import type { TemplateRateLimiterService } from "@src/template-marketplace/services/template-rate-limiter/template-rate-limiter.service";
import { TemplateSdlValidatorService } from "@src/template-marketplace/services/template-sdl-validator/template-sdl-validator.service";
import type { TemplateUsageService } from "@src/template-marketplace/services/template-usage/template-usage.service";
import type { TemplateVersionHoldService } from "@src/template-marketplace/services/template-version-hold/template-version-hold.service";
import { TemplateWriteAccessService } from "@src/template-marketplace/services/template-write-access/template-write-access.service";
import type { UserOutput } from "@src/user/repositories";
import { TemplateWriterService } from "./template-writer.service";

import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

const MEBIBYTE = 1024 ** 2;
const GIBIBYTE = 1024 ** 3;
const CREATE_RULE = { action: "create", subject: "Template" };
const UPDATE_RULE = { action: "update", subject: "Template" };
const DELETE_RULE = { action: "delete", subject: "Template" };
const SWITCH_ORGANIZATION_MESSAGE = "Switch to the template's organization to change it";
const PASSED_CHECKS: PublishCheckResults = { ranAt: "2026-11-18T10:00:00.000Z", checks: [{ key: "fixed_tags", status: "passed", issues: [] }] };
const FAILED_CHECKS: PublishCheckResults = {
  ranAt: "2026-11-18T10:00:00.000Z",
  checks: [{ key: "fixed_tags", status: "failed", issues: [{ message: "Pin the tag", service: "web", image: "nginx" }] }]
};

describe(TemplateWriterService.name, () => {
  describe("create", () => {
    it("creates the template and its first version in one transaction", async () => {
      const {
        service,
        repository,
        writableRepository,
        templateVersionRepository,
        marketplaceTemplateService,
        deploymentProjectService,
        user,
        transactionSteps
      } = setup();
      const sdl = buildSdl();
      const askedValues = [textAskedValue("GREETING")];
      const filingProjectId = faker.string.uuid();
      const templateId = faker.string.uuid();
      const output = mock<MarketplaceTemplateOutput>({ id: templateId });
      deploymentProjectService.resolveFilingProject.mockResolvedValue(filingProjectId);
      writableRepository.createTemplate.mockImplementation(async () => {
        transactionSteps.push("createTemplate");
        return templateId;
      });
      templateVersionRepository.appendVersion.mockImplementation(async () => {
        transactionSteps.push("appendVersion");
        return createVersion({ templateId });
      });
      marketplaceTemplateService.getTemplate.mockResolvedValue(output);
      const requestedProjectId = faker.string.uuid();

      const result = await service.create({ title: "Web", summary: "Serves the web", sdl, readme: "# Web", askedValues, projectId: requestedProjectId });

      expect(result).toBe(output);
      expect(transactionSteps).toEqual(["begin", "assertWithinLimits", "createTemplate", "appendVersion", "end"]);
      expect(repository.accessibleBy).toHaveBeenCalledWith(expect.anything(), "create");
      expect(deploymentProjectService.resolveFilingProject).toHaveBeenCalledWith(requestedProjectId, "Template");
      expect(writableRepository.createTemplate).toHaveBeenCalledWith({
        title: "Web",
        summary: "Serves the web",
        userId: user.userId,
        authorId: user.id,
        projectId: filingProjectId,
        copiedFromId: undefined,
        sdl,
        description: "# Web",
        cpu: 1000,
        ram: 1024 * MEBIBYTE,
        storage: 2 * GIBIBYTE
      });
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith({
        templateId,
        sdl,
        readme: "# Web",
        askedValues,
        resources: { cpu: 1, memoryBytes: 1024 * MEBIBYTE, storageBytes: 2 * GIBIBYTE },
        createdById: user.id
      });
      expect(marketplaceTemplateService.getTemplate).toHaveBeenCalledWith(templateId);
      expect(marketplaceTemplateService.findReadable).not.toHaveBeenCalled();
    });

    it("stores no summary or readme and an empty description when none is given", async () => {
      const { service, writableRepository, templateVersionRepository } = setup();

      await service.create({ title: "Web", summary: "", sdl: buildSdl(), askedValues: [] });

      expect(writableRepository.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ summary: null, description: "" }));
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ readme: null, askedValues: [] }));
    });

    it("stores the icon and categories given", async () => {
      const { service, writableRepository } = setup();

      await service.create({ title: "Web", sdl: buildSdl(), askedValues: [], icon: "rocket", categories: ["Tools", "AI - GPU"] });

      expect(writableRepository.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ icon: "rocket", categories: ["Tools", "AI - GPU"] }));
    });

    it("reports where a YAML error is without quoting the SDL around it", async () => {
      const { service } = setup();
      const sdl = ["services:", "  web:", "    env:", "      - API_KEY=hunter2-secret", "    image: [nginx"].join("\n");

      const error = await service.create({ title: "Web", sdl, askedValues: [] }).catch(caught => caught);

      expect(error.data.issues).toEqual(["The SDL could not be read: unexpected end of the stream within a flow collection (line 6, column 1)"]);
      expect(JSON.stringify({ message: error.message, data: error.data })).not.toContain("hunter2");
    });

    it("stores no resources when the SDL's hardware cannot be totalled", async () => {
      const { service, writableRepository, templateVersionRepository } = setup();

      await service.create({ title: "Web", sdl: buildSdl({ storageSize: "1.Gi" }), askedValues: [] });

      expect(writableRepository.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ cpu: 0, ram: 0, storage: 0 }));
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ resources: null }));
    });

    it("refuses creation without a create rule", async () => {
      const { service, writableRepository, templateVersionRepository, deploymentProjectService } = setup({ rules: [] });

      await expect(service.create({ title: "Web", sdl: buildSdl(), askedValues: [] })).rejects.toMatchObject({
        status: 403,
        message: "You cannot create templates"
      });
      expect(deploymentProjectService.resolveFilingProject).not.toHaveBeenCalled();
      expect(writableRepository.createTemplate).not.toHaveBeenCalled();
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
    });

    it("records the template a copy was made from once the caller has read it", async () => {
      const { service, writableRepository, marketplaceTemplateService } = setup();
      const copiedFromId = faker.string.uuid();

      await service.create({ title: "Copy", sdl: buildSdl(), askedValues: [], copiedFromId });

      expect(marketplaceTemplateService.findReadable).toHaveBeenCalledWith(copiedFromId);
      expect(writableRepository.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ copiedFromId }));
    });

    it("refuses copying from a template the caller cannot read, under a code that names the source", async () => {
      const { service, writableRepository, marketplaceTemplateService } = setup();
      marketplaceTemplateService.findReadable.mockRejectedValue(createError(404, "Template not found"));

      await expect(service.create({ title: "Copy", sdl: buildSdl(), askedValues: [], copiedFromId: faker.string.uuid() })).rejects.toMatchObject({
        status: 404,
        message: "The template to copy was not found",
        errorCode: "template_copy_source_not_found"
      });
      expect(writableRepository.createTemplate).not.toHaveBeenCalled();
    });

    it.each([
      ["a removed source", createError(410, "This template was removed", { errorCode: "template_removed" })],
      ["a failure that is not an HTTP refusal", new Error("connection lost")]
    ])("passes on %s as it is when the copy source cannot be read", async (_case, failure) => {
      const { service, marketplaceTemplateService } = setup();
      marketplaceTemplateService.findReadable.mockRejectedValue(failure);

      await expect(service.create({ title: "Copy", sdl: buildSdl(), askedValues: [], copiedFromId: faker.string.uuid() })).rejects.toBe(failure);
    });

    it("leaves a project that is gone its plain 404, so it is not taken for the copy source", async () => {
      const { service, deploymentProjectService } = setup();
      const projectGone = createError(404, "Project not found");
      deploymentProjectService.resolveFilingProject.mockRejectedValue(projectGone);

      await expect(service.create({ title: "Copy", sdl: buildSdl(), askedValues: [], copiedFromId: faker.string.uuid() })).rejects.toBe(projectGone);
    });

    it("counts the copy as a fork of its source inside the transaction, once the limits are checked", async () => {
      const source = createTemplateRow();
      const { service, templateUsageService, marketplaceTemplateService, user, transactionSteps } = setup();
      marketplaceTemplateService.findReadable.mockResolvedValue(source);
      const activeOrganizationId = faker.string.uuid();
      const { service: forkingService, templateUsageService: forkUsage, user: forker, transactionSteps: forkSteps } = setup({ activeOrganizationId });

      await service.create({ title: "Own", sdl: buildSdl(), askedValues: [] });
      await forkingService.create({ title: "Copy", sdl: buildSdl(), askedValues: [], copiedFromId: faker.string.uuid() });

      expect(templateUsageService.recordFork).not.toHaveBeenCalled();
      expect(transactionSteps).toEqual(["begin", "assertWithinLimits", "end"]);
      expect(user.id).not.toBe(forker.id);
      expect(forkUsage.recordFork).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }), {
        userId: forker.id,
        organizationId: activeOrganizationId
      });
      expect(forkSteps).toEqual(["begin", "assertWithinLimits", "recordFork", "end"]);
    });

    it("copies what the source's readers deploy when the copy is sent without an SDL", async () => {
      const currentVersionId = faker.string.uuid();
      const source = createTemplateRow({ currentVersionId, sdl: "version: 'legacy'", description: "Legacy description" });
      const askedValues = [textAskedValue("GREETING")];
      const current = createVersion({ id: currentVersionId, sdl: buildSdl({ env: ["GREETING=hello"] }), readme: "# Source readme", askedValues });
      const { service, writableRepository, templateVersionRepository, marketplaceTemplateService, templateUsageService } = setup({ template: source });
      marketplaceTemplateService.findReadable.mockResolvedValue(source);
      templateVersionRepository.findById.mockResolvedValue(current);

      await service.create({ title: "Copy", copiedFromId: source.id });

      expect(templateVersionRepository.findById).toHaveBeenCalledWith(currentVersionId);
      expect(writableRepository.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ copiedFromId: source.id, sdl: current.sdl, description: "# Source readme" })
      );
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(
        expect.objectContaining({ sdl: current.sdl, readme: "# Source readme", askedValues, resources: expect.objectContaining({ cpu: 1 }) })
      );
      expect(templateUsageService.recordFork).toHaveBeenCalledWith(source, expect.anything());
    });

    it("copies the description a source shows in place of a readme its version does not have", async () => {
      const currentVersionId = faker.string.uuid();
      const source = createTemplateRow({ currentVersionId, description: "Shown as readme" });
      const { service, templateVersionRepository, marketplaceTemplateService } = setup({ template: source });
      marketplaceTemplateService.findReadable.mockResolvedValue(source);
      templateVersionRepository.findById.mockResolvedValue(createVersion({ id: currentVersionId, readme: null }));

      await service.create({ title: "Copy", copiedFromId: source.id });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ readme: "Shown as readme" }));
    });

    it("copies the stored SDL of a source saved before versions, with no readme when it has no description", async () => {
      const source = createTemplateRow({ currentVersionId: null, sdl: buildSdl({ count: 3 }), description: "" });
      const { service, writableRepository, templateVersionRepository, marketplaceTemplateService } = setup({ template: source });
      marketplaceTemplateService.findReadable.mockResolvedValue(source);

      await service.create({ title: "Copy", copiedFromId: source.id });

      expect(templateVersionRepository.findById).not.toHaveBeenCalled();
      expect(writableRepository.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ sdl: source.sdl, description: "" }));
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ sdl: source.sdl, readme: null, askedValues: [] }));
    });

    it("keeps the content a copy was sent with rather than the source's", async () => {
      const source = createTemplateRow({ currentVersionId: faker.string.uuid() });
      const { service, templateVersionRepository, marketplaceTemplateService } = setup({ template: source });
      marketplaceTemplateService.findReadable.mockResolvedValue(source);
      const sdl = buildSdl({ count: 5 });

      await service.create({ title: "Copy", sdl, readme: "Edited", copiedFromId: source.id });

      expect(templateVersionRepository.findById).not.toHaveBeenCalled();
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ sdl, readme: "Edited", askedValues: [] }));
    });

    it("refuses to copy a source whose content carries a secret's value, so none comes across", async () => {
      const currentVersionId = faker.string.uuid();
      const source = createTemplateRow({ currentVersionId });
      const { service, writableRepository, templateVersionRepository, marketplaceTemplateService, templateUsageService } = setup({ template: source });
      marketplaceTemplateService.findReadable.mockResolvedValue(source);
      templateVersionRepository.findById.mockResolvedValue(
        createVersion({ id: currentVersionId, sdl: buildSdl({ env: ["API_KEY=hunter2"] }), askedValues: [secretAskedValue("API_KEY")] })
      );

      await expect(service.create({ title: "Copy", copiedFromId: source.id })).rejects.toMatchObject({ status: 400, errorCode: "template_invalid" });
      expect(writableRepository.createTemplate).not.toHaveBeenCalled();
      expect(templateUsageService.recordFork).not.toHaveBeenCalled();
    });

    it("refuses a template sent with neither an SDL nor a source to copy", async () => {
      const { service, writableRepository, marketplaceTemplateService } = setup();

      await expect(service.create({ title: "Nothing" })).rejects.toMatchObject({ status: 400, message: "Send the SDL, or name the template to copy" });
      expect(marketplaceTemplateService.findReadable).not.toHaveBeenCalled();
      expect(writableRepository.createTemplate).not.toHaveBeenCalled();
    });

    it("refuses an SDL that leaks a secret with every issue it found", async () => {
      const { service, writableRepository } = setup();
      const sdl = buildSdl({ env: ["API_KEY=hunter2", "TOKEN=ac-secret://TOKEN"] });
      const issues = [
        'Variable "API_KEY" is a secret, so web.env.API_KEY must not carry a value',
        "web.env.TOKEN references a secret that no variable asks the deployer for"
      ];

      await expect(service.create({ title: "Web", sdl, askedValues: [secretAskedValue("API_KEY")] })).rejects.toMatchObject({
        status: 400,
        message: issues.join("; "),
        errorCode: "template_invalid",
        data: { issues }
      });
      expect(writableRepository.createTemplate).not.toHaveBeenCalled();
    });

    it("refuses an asked value the SDL cannot hold", async () => {
      const { service } = setup();
      const askedValue = { ...textAskedValue("GREETING"), bindings: [{ service: "api", env: "GREETING" }] };

      await expect(service.create({ title: "Web", sdl: buildSdl(), askedValues: [askedValue] })).rejects.toMatchObject({
        status: 400,
        data: { issues: ['Variable "GREETING" fills in service "api", which the SDL does not define'] }
      });
    });

    it.each<[string, string, string[]]>([
      [
        "a document that is not YAML",
        "services: [web",
        ["The SDL could not be read: unexpected end of the stream within a flow collection (line 2, column 1)"]
      ],
      [
        "a document followed by another",
        "services: {}\n---\nservices: {}",
        ["The SDL could not be read: expected a single document in the stream, but found more"]
      ],
      ["a scalar document", "just text", ["The SDL could not be read"]],
      ["a list document", "- web", ["The SDL could not be read"]],
      ["an empty document", "", ["The SDL could not be read"]],
      ["a document without services", "version: '2.0'", ["The SDL defines no services"]],
      ["a document whose services are a list", "version: '2.0'\nservices:\n  - web", ["The SDL defines no services"]],
      ["a document whose services are text", "version: '2.0'\nservices: web", ["The SDL defines no services"]],
      ["a document whose services are empty", "version: '2.0'\nservices:", ["The SDL defines no services"]],
      ["a null document", "~", ["The SDL could not be read"]],
      ["a document with no service defined", "version: '2.0'\nservices: {}", ["The SDL defines no services"]],
      [
        "a map-form env",
        buildSdl({ envMapping: ["API_KEY: hunter2"] }),
        ['"env" at "/services/web" should be array.', '"env" at "/services/web" should be null.']
      ],
      [
        "a numeric registry password",
        buildSdl({ credentials: ["host: docker.io", "username: me", "password: 12345"] }),
        ['"password" at "/services/web/credentials" should be string.']
      ],
      ["an unknown reference kind", buildSdl({ env: ["API_KEY=ac-vault://API_KEY"] }), ['"ac-vault://API_KEY" uses unknown SDL Reference kind "vault"']],
      ["an alias that expands past the limit", buildAliasBomb(), [EXPANDED_SDL_TOO_LARGE_MESSAGE]]
    ])("refuses %s before checking its values", async (_case, sdl, issues) => {
      const { service, writableRepository } = setup();

      const error = await service.create({ title: "Web", sdl, askedValues: [secretAskedValue("API_KEY")] }).catch(caught => caught);

      expect(error).toMatchObject({ status: 400, errorCode: "template_invalid" });
      expect(error.data.issues).toEqual(issues);
      expect(writableRepository.createTemplate).not.toHaveBeenCalled();
    });

    it("refuses an unreadable SDL even when it asks the deployer nothing", async () => {
      const { service, writableRepository } = setup();

      await expect(service.create({ title: "Web", sdl: "just text", askedValues: [] })).rejects.toMatchObject({
        status: 400,
        data: { issues: ["The SDL could not be read"] }
      });
      expect(writableRepository.createTemplate).not.toHaveBeenCalled();
    });

    it("holds the creation to the limits of the caller and the active organization", async () => {
      const template = createTemplateRow();
      const { service, templateRateLimiterService, user } = setup({ template });

      await service.create({ title: "Web", sdl: buildSdl(), askedValues: [] });

      expect(templateRateLimiterService.assertWithinLimits).toHaveBeenCalledWith("create", { userId: user.id, organizationId: template.organizationId });
    });

    it("creates nothing once a limit is reached", async () => {
      const rateLimitError = createError(429, "Too many", { errorCode: "template_rate_limited" });
      const { service, writableRepository, templateVersionRepository } = setup({ rateLimitError });

      await expect(service.create({ title: "Web", sdl: buildSdl(), askedValues: [] })).rejects.toBe(rateLimitError);
      expect(writableRepository.createTemplate).not.toHaveBeenCalled();
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
    });

    it("refuses creation without an active organization to file the template in", async () => {
      const { service, txService } = setup({ activeOrganizationId: null });

      await expect(service.create({ title: "Web", sdl: buildSdl(), askedValues: [] })).rejects.toMatchObject({
        status: 403,
        message: "You cannot create templates"
      });
      expect(txService.transaction).not.toHaveBeenCalled();
    });
  });

  describe("appendVersion", () => {
    it("saves a version on the current one and mirrors the legacy columns in one transaction", async () => {
      const template = createTemplateRow();
      const base = createVersion({ templateId: template.id, version: 3, readme: "# Before" });
      const { service, repository, templateVersionRepository, user, transactionSteps } = setup({ template, base });
      const sdl = buildSdl({ count: 3 });
      const askedValues = [textAskedValue("GREETING")];
      const appended = createVersion({ templateId: template.id, version: 4, imageDigests: { web: "sha256:abc" } });
      templateVersionRepository.appendVersion.mockImplementation(async () => {
        transactionSteps.push("appendVersion");
        return appended;
      });
      repository.mirrorVersion.mockImplementation(async () => {
        transactionSteps.push("mirrorVersion");
      });

      const result = await service.appendVersion(template.id, { sdl, readme: "# After", askedValues, baseVersion: 3 });

      expect(result).toEqual(appended);
      expect(transactionSteps).toEqual(["begin", "findAndLockForWrite", "assertWithinLimits", "appendVersion", "mirrorVersion", "end"]);
      expect(repository.findAndLockForWrite).toHaveBeenCalledWith(template.id);
      expect(templateVersionRepository.findByTemplateAndVersion).toHaveBeenCalledWith(template.id, 3);
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith({
        templateId: template.id,
        sdl,
        readme: "# After",
        askedValues,
        resources: { cpu: 1.5, memoryBytes: 1536 * MEBIBYTE, storageBytes: 3 * GIBIBYTE },
        createdById: user.id,
        expectedCurrentVersionId: base.id,
        readmesShown: { current: "# Before", next: "# After" },
        holdReasons: []
      });
      expect(repository.mirrorVersion).toHaveBeenCalledWith(template.id, {
        sdl,
        description: "# After",
        cpu: 1500,
        ram: 1536 * MEBIBYTE,
        storage: 3 * GIBIBYTE
      });
    });

    it("carries the current readme forward when the version omits it", async () => {
      const template = createTemplateRow();
      const { service, repository, templateVersionRepository } = setup({ template, base: createVersion({ templateId: template.id, readme: "# Before" }) });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ readme: "# Before" }));
      expect(repository.mirrorVersion).toHaveBeenCalledWith(template.id, expect.objectContaining({ description: "# Before" }));
    });

    it("clears the readme with null and empties the legacy description", async () => {
      const template = createTemplateRow({ description: "Legacy description" });
      const { service, repository, templateVersionRepository } = setup({ template, base: createVersion({ templateId: template.id, readme: "# Before" }) });

      await service.appendVersion(template.id, { sdl: buildSdl(), readme: null, askedValues: [], baseVersion: 1 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ readme: null }));
      expect(repository.mirrorVersion).toHaveBeenCalledWith(template.id, expect.objectContaining({ description: "" }));
    });

    it("carries the legacy description forward as the readme of a version saved without one", async () => {
      const template = createTemplateRow({ description: "Legacy description" });
      const { service, repository, templateVersionRepository } = setup({ template, base: createVersion({ templateId: template.id, readme: null }) });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ readme: "Legacy description" }));
      expect(repository.mirrorVersion).toHaveBeenCalledWith(template.id, expect.objectContaining({ description: "Legacy description" }));
    });

    it("tells the readme change against the legacy description a version saved without a readme shows", async () => {
      const template = createTemplateRow({ description: "Legacy description" });
      const { service, templateVersionRepository } = setup({ template, base: createVersion({ templateId: template.id, readme: null }) });

      await service.appendVersion(template.id, { sdl: buildSdl(), readme: "# New", askedValues: [], baseVersion: 1 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(
        expect.objectContaining({ readme: "# New", readmesShown: { current: "Legacy description", next: "# New" } })
      );
    });

    it("carries no readme forward when neither the version nor the legacy description holds one", async () => {
      const template = createTemplateRow({ description: "" });
      const { service, repository, templateVersionRepository } = setup({ template, base: createVersion({ templateId: template.id, readme: null }) });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ readme: null }));
      expect(repository.mirrorVersion).toHaveBeenCalledWith(template.id, expect.objectContaining({ description: "" }));
    });

    it("carries forward the readme the locked template shows rather than the one read before the lock", async () => {
      const template = createTemplateRow({ description: "Read before the lock" });
      const locked = { ...template, description: "Saved meanwhile" };
      const { service, templateVersionRepository } = setup({ template, locked, base: createVersion({ templateId: template.id, readme: null }) });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ readme: "Saved meanwhile" }));
    });

    it("checks the base version against the locked template rather than the one read before the lock", async () => {
      const template = createTemplateRow({ currentVersionId: null });
      const locked = { ...template, currentVersionId: faker.string.uuid() };
      const { service, templateVersionRepository } = setup({ template, locked, base: null });

      await expect(service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 })).rejects.toMatchObject({ status: 409 });
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
    });

    it("asks for the base version of a template that has one", async () => {
      const template = createTemplateRow();
      const { service, repository, templateVersionRepository } = setup({ template });

      await expect(service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [] })).rejects.toMatchObject({
        status: 400,
        message: "Name the version this one was edited from",
        errorCode: "template_base_version_required"
      });
      expect(templateVersionRepository.findByTemplateAndVersion).not.toHaveBeenCalled();
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      expect(repository.mirrorVersion).not.toHaveBeenCalled();
    });

    it("saves the first version of a template that has none without a base version", async () => {
      const template = createTemplateRow({ currentVersionId: null });
      const { service, templateVersionRepository } = setup({ template, base: null });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [] });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ expectedCurrentVersionId: undefined }));
    });

    it("saves a first version without a base check on a template that has none yet", async () => {
      const template = createTemplateRow({ currentVersionId: null, description: "Legacy description" });
      const { service, templateVersionRepository } = setup({ template, base: null });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 3 });

      expect(templateVersionRepository.findByTemplateAndVersion).not.toHaveBeenCalled();
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: template.id, readme: "Legacy description", expectedCurrentVersionId: undefined })
      );
    });

    it("answers 409 when the base version does not exist", async () => {
      const template = createTemplateRow();
      const { service, repository, templateVersionRepository } = setup({ template, base: null });

      await expect(service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 7 })).rejects.toMatchObject({
        status: 409,
        message: "The template has a newer version",
        errorCode: "template_version_conflict"
      });
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      expect(repository.mirrorVersion).not.toHaveBeenCalled();
    });

    it("refuses a caller who may read the template but not change it", async () => {
      const template = createTemplateRow();
      const { service, templateVersionRepository } = setup({
        template,
        rules: [{ action: "update", subject: "Template", conditions: { id: faker.string.uuid() } }]
      });

      await expect(service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 })).rejects.toMatchObject({
        status: 403,
        message: "You cannot change this template"
      });
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
    });

    it("allows a caller whose update rule matches the template", async () => {
      const template = createTemplateRow();
      const { service, templateVersionRepository } = setup({ template, rules: [{ action: "update", subject: "Template", conditions: { id: template.id } }] });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalled();
    });

    it("refuses a version whose SDL leaks a secret before looking up its base", async () => {
      const template = createTemplateRow();
      const { service, templateVersionRepository } = setup({ template });

      await expect(
        service.appendVersion(template.id, { sdl: buildSdl({ env: ["API_KEY=hunter2"] }), askedValues: [secretAskedValue("API_KEY")], baseVersion: 1 })
      ).rejects.toMatchObject({ status: 400, errorCode: "template_invalid" });
      expect(templateVersionRepository.findByTemplateAndVersion).not.toHaveBeenCalled();
    });

    it("holds the save to the limits of the caller and the template's organization", async () => {
      const template = createTemplateRow();
      const { service, templateRateLimiterService, user } = setup({ template });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templateRateLimiterService.assertWithinLimits).toHaveBeenCalledWith("version", { userId: user.id, organizationId: template.organizationId });
    });

    it("saves nothing once a limit is reached", async () => {
      const template = createTemplateRow();
      const rateLimitError = createError(429, "Too many", { errorCode: "template_rate_limited" });
      const { service, templateVersionRepository } = setup({ template, rateLimitError });

      await expect(service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 })).rejects.toBe(rateLimitError);
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
    });

    it.each(["private", "organization"] as const)("runs no publish check on a version of a %s template", async visibility => {
      const template = createTemplateRow({ visibility });
      const { service, templateVersionRepository, publishChecksService } = setup({ template });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(publishChecksService.run).not.toHaveBeenCalled();
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ checkResults: undefined }));
    });

    it("holds a version saved without a readme to the readme it carries forward", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true, description: "A legacy description" });
      const { service, publishChecksService } = setup({ template });

      await service.appendVersion(template.id, { sdl: buildSdl({ count: 3 }), askedValues: [], baseVersion: 1 });

      expect(publishChecksService.run).toHaveBeenCalledWith(expect.objectContaining({ readme: "A legacy description" }));
    });

    it("runs the publish checks on a version of a public template under the locked title and stores what they found", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true });
      const locked = { ...template, title: "Renamed since", summary: "Summarized since" };
      const { service, repository, templateVersionRepository, publishChecksService } = setup({ template, locked });
      const sdl = buildSdl({ count: 3 });
      const askedValues = [textAskedValue("GREETING")];

      await service.appendVersion(template.id, { sdl, readme: "# Hello", askedValues, baseVersion: 1 });

      expect(publishChecksService.run).toHaveBeenCalledWith({
        sdl,
        readme: "# Hello",
        askedValues,
        title: "Renamed since",
        summary: "Summarized since",
        organizationId: template.organizationId
      });
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ checkResults: PASSED_CHECKS }));
      expect(repository.mirrorVersion).toHaveBeenCalledTimes(1);
    });

    it("sends no notice about a version that went live", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true });
      const { service, templatePublisherNotifierService } = setup({ template });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templatePublisherNotifierService.notifyVersionFailedChecks).not.toHaveBeenCalled();
    });

    it("tells the rest of the publisher about a version that failed its checks, inside the save's transaction", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true });
      const { service, templateVersionRepository, templatePublisherNotifierService, user, transactionSteps } = setup({ template, checkResults: FAILED_CHECKS });
      const failed = createVersion({ templateId: template.id, version: 2, status: "failed_checks", checkResults: FAILED_CHECKS });
      templateVersionRepository.appendVersion.mockResolvedValue(failed);

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templatePublisherNotifierService.notifyVersionFailedChecks).toHaveBeenCalledWith({ versionId: failed.id, savedByUserId: user.id });
      expect(transactionSteps).toEqual(["begin", "findAndLockForWrite", "assertWithinLimits", "notifyVersionFailedChecks", "end"]);
    });

    it("answers a version that failed its checks without mirroring it into the legacy columns", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true });
      const { service, repository, templateVersionRepository } = setup({ template, checkResults: FAILED_CHECKS });
      const failed = createVersion({ templateId: template.id, version: 2, status: "failed_checks", checkResults: FAILED_CHECKS });
      templateVersionRepository.appendVersion.mockResolvedValue(failed);

      const result = await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(result).toMatchObject({ id: failed.id, status: "failed_checks", checkResults: FAILED_CHECKS });
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ checkResults: FAILED_CHECKS }));
      expect(repository.mirrorVersion).not.toHaveBeenCalled();
    });

    it("holds a save edited from a failed version to the version that was current when it failed", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true });
      const failedBase = createVersion({ templateId: template.id, version: 3, status: "failed_checks", readme: "# Failed draft" });
      const current = createVersion({ templateId: template.id, version: 2, readme: "# Read today" });
      const { service, templateVersionRepository } = setup({ template, base: failedBase });
      templateVersionRepository.findCurrent.mockResolvedValue(current);

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 3 });

      expect(templateVersionRepository.findCurrent).toHaveBeenCalledWith(template.id);
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedCurrentVersionId: current.id,
          readme: "# Failed draft",
          readmesShown: { current: "# Read today", next: "# Failed draft" }
        })
      );
    });

    it.each([
      { shape: "a version saved after it became current", currentVersion: 4 },
      { shape: "the template has no current version left to compare", currentVersion: undefined }
    ])("holds a save edited from a failed version to that version when $shape", async ({ currentVersion }) => {
      const template = createTemplateRow({ visibility: "public", isPublic: true });
      const failedBase = createVersion({ templateId: template.id, version: 3, status: "failed_checks" });
      const { service, templateVersionRepository } = setup({ template, base: failedBase });
      templateVersionRepository.findCurrent.mockResolvedValue(currentVersion ? createVersion({ templateId: template.id, version: currentVersion }) : undefined);

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 3 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ expectedCurrentVersionId: failedBase.id }));
    });

    it("saves on the version it was edited from when that one is live", async () => {
      const template = createTemplateRow();
      const base = createVersion({ templateId: template.id, version: 1, status: "live" });
      const { service, templateVersionRepository } = setup({ template, base });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ expectedCurrentVersionId: base.id }));
    });
  });

  describe("image digests", () => {
    it("queues the digests of a new template's first version inside the transaction that saves it", async () => {
      const { service, templateVersionRepository, templateImageDigestJobService, transactionSteps } = setup();
      const first = createVersion();
      templateVersionRepository.appendVersion.mockResolvedValue(first);
      templateImageDigestJobService.schedule.mockImplementation(async () => {
        transactionSteps.push("scheduleImageDigests");
      });

      await service.create({ title: "Web", sdl: buildSdl(), askedValues: [] });

      expect(templateImageDigestJobService.schedule).toHaveBeenCalledWith(first.id);
      expect(transactionSteps).toEqual(["begin", "assertWithinLimits", "scheduleImageDigests", "end"]);
    });

    it.each([
      { status: "live" as const, visibility: "private" as const },
      { status: "failed_checks" as const, visibility: "public" as const },
      { status: "held" as const, visibility: "public" as const }
    ])("queues the digests of a $status version of a $visibility template inside the transaction that saves it", async ({ status, visibility }) => {
      const template = createTemplateRow({ visibility, isPublic: visibility === "public" });
      const { service, templateVersionRepository, templateImageDigestJobService, transactionSteps } = setup({ template });
      const appended = createVersion({ templateId: template.id, version: 2, status });
      templateVersionRepository.appendVersion.mockResolvedValue(appended);
      templateImageDigestJobService.schedule.mockImplementation(async () => {
        transactionSteps.push("scheduleImageDigests");
      });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templateImageDigestJobService.schedule).toHaveBeenCalledWith(appended.id);
      expect(transactionSteps.slice(0, 4)).toEqual(["begin", "findAndLockForWrite", "assertWithinLimits", "scheduleImageDigests"]);
      expect(transactionSteps.at(-1)).toBe("end");
    });
  });

  describe("held versions", () => {
    const HOLD_REASONS: TemplateVersionHoldReason[] = [
      { kind: "image_repository_changed", message: "Moves to another repository.", service: "web", image: "other/web:1", previousImage: "acme/web:1" }
    ];

    it("judges a passing version of a public template against the version people deploy today, on the locked template", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true, isOfficial: false });
      const locked = { ...template, isOfficial: true };
      const { service, templateVersionRepository, templateVersionHoldService } = setup({ template, locked, holdReasons: HOLD_REASONS });
      const current = createVersion({ templateId: template.id, version: 1, sdl: buildSdl({ count: 2 }) });
      templateVersionRepository.findCurrent.mockResolvedValue(current);
      const sdl = buildSdl({ count: 3 });

      await service.appendVersion(template.id, { sdl, askedValues: [], baseVersion: 1 });

      expect(templateVersionRepository.findCurrent).toHaveBeenCalledWith(template.id);
      expect(templateVersionHoldService.findHoldReasons).toHaveBeenCalledWith(locked, current.sdl, sdl);
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ checkResults: PASSED_CHECKS, holdReasons: HOLD_REASONS }));
    });

    it("judges against the legacy SDL of a public template that has no current version", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true, currentVersionId: null, sdl: "version: '2.0'" });
      const { service, templateVersionRepository, templateVersionHoldService } = setup({ template });
      templateVersionRepository.findCurrent.mockResolvedValue(undefined);
      const sdl = buildSdl();

      await service.appendVersion(template.id, { sdl, askedValues: [] });

      expect(templateVersionHoldService.findHoldReasons).toHaveBeenCalledWith(template, "version: '2.0'", sdl);
    });

    it("tells the publisher about a held version inside the save's transaction, and mirrors nothing into the legacy columns", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true });
      const { service, repository, templateVersionRepository, templatePublisherNotifierService, transactionSteps } = setup({
        template,
        holdReasons: HOLD_REASONS
      });
      const held = createVersion({ templateId: template.id, version: 2, status: "held", holdReasons: HOLD_REASONS });
      templateVersionRepository.appendVersion.mockResolvedValue(held);

      const result = await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(result).toEqual(held);
      expect(templatePublisherNotifierService.notifyVersionHeld).toHaveBeenCalledWith(held.id);
      expect(templatePublisherNotifierService.notifyVersionFailedChecks).not.toHaveBeenCalled();
      expect(repository.mirrorVersion).not.toHaveBeenCalled();
      expect(transactionSteps).toEqual(["begin", "findAndLockForWrite", "assertWithinLimits", "notifyVersionHeld", "end"]);
    });

    it("tells nobody that a version is held when it went live", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true });
      const { service, templatePublisherNotifierService } = setup({ template });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templatePublisherNotifierService.notifyVersionHeld).not.toHaveBeenCalled();
    });

    it("never holds a version that failed its checks", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true, isOfficial: true });
      const { service, templateVersionRepository, templateVersionHoldService, templatePublisherNotifierService } = setup({
        template,
        checkResults: FAILED_CHECKS,
        holdReasons: HOLD_REASONS
      });
      templateVersionRepository.appendVersion.mockResolvedValue(createVersion({ templateId: template.id, version: 2, status: "failed_checks" }));

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templateVersionHoldService.findHoldReasons).not.toHaveBeenCalled();
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ checkResults: FAILED_CHECKS, holdReasons: undefined }));
      expect(templatePublisherNotifierService.notifyVersionHeld).not.toHaveBeenCalled();
    });

    it.each([
      { visibility: "private" as const, publishedAt: new Date("2026-10-01T00:00:00.000Z") },
      { visibility: "organization" as const, publishedAt: new Date("2026-10-01T00:00:00.000Z") },
      { visibility: "private" as const, publishedAt: null },
      { visibility: "organization" as const, publishedAt: null }
    ])(
      "judges a $visibility template published at $publishedAt, so a risky version saved out of sight waits for staff",
      async ({ visibility, publishedAt }) => {
        const template = createTemplateRow({ visibility, publishedAt });
        const { service, templateVersionRepository, templateVersionHoldService, publishChecksService } = setup({ template, holdReasons: HOLD_REASONS });
        const sdl = buildSdl({ count: 3 });

        await service.appendVersion(template.id, { sdl, askedValues: [], baseVersion: 1 });

        expect(publishChecksService.run).not.toHaveBeenCalled();
        expect(templateVersionHoldService.findHoldReasons).toHaveBeenCalledWith(template, expect.any(String), sdl);
        expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ checkResults: undefined, holdReasons: HOLD_REASONS }));
      }
    );

    it.each(["private", "organization"] as const)("saves a version of a %s template that nothing holds without a reason", async visibility => {
      const template = createTemplateRow({ visibility });
      const { service, templateVersionRepository, templatePublisherNotifierService } = setup({ template });

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ checkResults: undefined, holdReasons: [] }));
      expect(templatePublisherNotifierService.notifyVersionHeld).not.toHaveBeenCalled();
    });

    it.each(["held", "rejected"] as const)("holds a save edited from a %s version to the version that was current when it was saved", async status => {
      const template = createTemplateRow({ visibility: "public", isPublic: true });
      const base = createVersion({ templateId: template.id, version: 3, status });
      const current = createVersion({ templateId: template.id, version: 2 });
      const { service, templateVersionRepository } = setup({ template, base });
      templateVersionRepository.findCurrent.mockResolvedValue(current);

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 3 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ expectedCurrentVersionId: current.id }));
    });

    it.each(["held", "rejected"] as const)(
      "carries the readme of a %s version forward and tells its change against the readme people read today",
      async status => {
        const template = createTemplateRow({ visibility: "public", isPublic: true });
        const base = createVersion({ templateId: template.id, version: 3, status, readme: "# Edited" });
        const { service, templateVersionRepository } = setup({ template, base });
        templateVersionRepository.findCurrent.mockResolvedValue(createVersion({ templateId: template.id, version: 2, readme: "# Read today" }));

        await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 3 });

        expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(
          expect.objectContaining({ readme: "# Edited", readmesShown: { current: "# Read today", next: "# Edited" } })
        );
      }
    );

    it("tells the readme change of a save edited from a held version against the legacy description when the version read today has no readme", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true, description: "Legacy description" });
      const base = createVersion({ templateId: template.id, version: 3, status: "held", readme: "# Edited" });
      const { service, templateVersionRepository } = setup({ template, base });
      templateVersionRepository.findCurrent.mockResolvedValue(createVersion({ templateId: template.id, version: 2, readme: null }));

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 3 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(
        expect.objectContaining({ readmesShown: { current: "Legacy description", next: "# Edited" } })
      );
    });

    it("holds a save edited from the live version to it and tells the readme change against its readme", async () => {
      const template = createTemplateRow();
      const base = createVersion({ templateId: template.id, readme: "# Before" });
      const { service, templateVersionRepository } = setup({ template, base });

      await service.appendVersion(template.id, { sdl: buildSdl(), readme: "# After", askedValues: [], baseVersion: 1 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(
        expect.objectContaining({ expectedCurrentVersionId: base.id, readmesShown: { current: "# Before", next: "# After" } })
      );
    });

    it("refuses nothing itself for a save edited from a held version a newer one replaced, leaving the conflict to the append", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true });
      const base = createVersion({ templateId: template.id, version: 3, status: "held" });
      const { service, templateVersionRepository } = setup({ template, base });
      templateVersionRepository.findCurrent.mockResolvedValue(createVersion({ templateId: template.id, version: 4 }));

      await service.appendVersion(template.id, { sdl: buildSdl(), askedValues: [], baseVersion: 3 });

      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ expectedCurrentVersionId: base.id }));
    });
  });

  describe("updateSettings", () => {
    it("re-checks the locked template, then updates its settings in one transaction and answers the template", async () => {
      const template = createTemplateRow();
      const { service, repository, marketplaceTemplateService, transactionSteps } = setup({ template });
      const output = mock<MarketplaceTemplateOutput>({ id: template.id });
      repository.updateSettings.mockImplementation(async () => {
        transactionSteps.push("updateSettings");
      });
      marketplaceTemplateService.getTemplate.mockImplementation(async () => {
        transactionSteps.push("getTemplate");
        return output;
      });

      const result = await service.updateSettings(template.id, {
        title: "Renamed",
        summary: "Serves the web",
        icon: "rocket",
        categories: ["Tools"],
        visibility: "organization"
      });

      expect(result).toBe(output);
      expect(transactionSteps).toEqual(["begin", "findAndLockForWrite", "updateSettings", "end", "getTemplate"]);
      expect(marketplaceTemplateService.findReadable).toHaveBeenCalledWith(template.id);
      expect(repository.findAndLockForWrite).toHaveBeenCalledWith(template.id);
      expect(repository.updateSettings).toHaveBeenCalledWith(template.id, {
        title: "Renamed",
        summary: "Serves the web",
        icon: "rocket",
        categories: ["Tools"],
        visibility: "organization",
        isPublic: false
      });
      expect(marketplaceTemplateService.getTemplate).toHaveBeenCalledWith(template.id);
    });

    it("refuses opening a private template to its organization while its current version holds a secret value", async () => {
      const template = createTemplateRow({ visibility: "private" });
      const { service, repository, templateVersionRepository } = setup({ template });
      const current = createVersion({
        templateId: template.id,
        sdl: buildSdl({ credentials: ["host: docker.io", "username: me", "password: hunter2"] }),
        askedValues: []
      });
      templateVersionRepository.findCurrent.mockResolvedValue(current);
      const issue = 'Service "web" carries a registry password; save it as a secret instead';

      await expect(service.updateSettings(template.id, { visibility: "organization" })).rejects.toMatchObject({
        status: 400,
        errorCode: "template_invalid",
        data: { issues: [issue] }
      });
      expect(templateVersionRepository.findCurrent).toHaveBeenCalledWith(template.id);
      expect(repository.updateSettings).not.toHaveBeenCalled();
    });

    it("checks the current version's asked values when opening a template to its organization", async () => {
      const template = createTemplateRow({ visibility: "private" });
      const { service, repository, templateVersionRepository } = setup({ template });
      templateVersionRepository.findCurrent.mockResolvedValue(
        createVersion({ templateId: template.id, sdl: buildSdl({ env: ["API_KEY"] }), askedValues: [secretAskedValue("API_KEY")] })
      );

      await service.updateSettings(template.id, { visibility: "organization" });

      expect(repository.updateSettings).toHaveBeenCalledWith(template.id, { visibility: "organization", isPublic: false });
    });

    it("checks the legacy SDL of a template saved without a version when opening it to its organization", async () => {
      const template = createTemplateRow({ visibility: "private", currentVersionId: null, sdl: buildSdl({ env: ["TOKEN=ac-secret://TOKEN"] }) });
      const { service, repository, templateVersionRepository } = setup({ template });
      templateVersionRepository.findCurrent.mockResolvedValue(undefined);

      await expect(service.updateSettings(template.id, { visibility: "organization" })).rejects.toMatchObject({ status: 400 });
      expect(repository.updateSettings).not.toHaveBeenCalled();
    });

    it.each<[string, string]>([
      ["a registry password typed as a number", buildSdl({ credentials: ["host: docker.io", "username: me", "password: 12345"] })],
      ["an env written as a mapping", buildSdl({ envMapping: ["API_KEY: hunter2"] })],
      ["an SDL that cannot be read", "services: [unclosed"]
    ])("refuses opening a private template to its organization while its current version holds %s", async (_case, sdl) => {
      const template = createTemplateRow({ visibility: "private" });
      const { service, repository, templateVersionRepository } = setup({ template });
      templateVersionRepository.findCurrent.mockResolvedValue(createVersion({ templateId: template.id, sdl, askedValues: [] }));

      await expect(service.updateSettings(template.id, { visibility: "organization" })).rejects.toMatchObject({
        status: 400,
        errorCode: "template_invalid",
        data: { issues: expect.arrayContaining([expect.any(String)]) }
      });
      expect(repository.updateSettings).not.toHaveBeenCalled();
    });

    it.each<[string, "private" | "organization" | "public", "private" | "organization" | undefined]>([
      ["keeping a private template private", "private", "private"],
      ["narrowing an organization template", "organization", "private"],
      ["bringing a public template to its organization", "public", "organization"],
      ["leaving the visibility alone", "private", undefined]
    ])("checks no secret value when %s", async (_case, visibility, nextVisibility) => {
      const template = createTemplateRow({ visibility });
      const { service, repository, templateVersionRepository } = setup({ template });

      await service.updateSettings(template.id, { title: "Renamed", visibility: nextVisibility });

      expect(templateVersionRepository.findCurrent).not.toHaveBeenCalled();
      expect(repository.updateSettings).toHaveBeenCalled();
    });

    it("writes only the settings sent, leaving isPublic alone without a visibility", async () => {
      const template = createTemplateRow();
      const { service, repository } = setup({ template });

      await service.updateSettings(template.id, { title: "Renamed" });

      expect(repository.updateSettings).toHaveBeenCalledWith(template.id, { title: "Renamed" });
    });

    it.each<[string, string | null]>([
      ["an empty summary", ""],
      ["a null summary", null]
    ])("stores %s as no summary", async (_case, summary) => {
      const template = createTemplateRow({ summary: "Before" });
      const { service, repository } = setup({ template });

      await service.updateSettings(template.id, { summary, icon: null });

      expect(repository.updateSettings).toHaveBeenCalledWith(template.id, { summary: null, icon: null });
    });

    it("refuses a reserved word in the new title of a public template, naming the check that failed", async () => {
      const template = createTemplateRow({ visibility: "public", isPublic: true });
      const { service, repository } = setup({ template });

      await expect(service.updateSettings(template.id, { title: "Official Llama" })).rejects.toMatchObject({
        status: 400,
        errorCode: "template_publish_checks_failed",
        message: 'Titles can\'t contain "Official", which is reserved for Akash. Rename the template.',
        data: {
          checks: [
            {
              key: "name_not_reserved",
              status: "failed",
              issues: [{ message: 'Titles can\'t contain "Official", which is reserved for Akash. Rename the template.', field: "title" }]
            }
          ]
        }
      });
      expect(repository.updateSettings).not.toHaveBeenCalled();
    });

    it("judges the title against the locked template's visibility rather than the one read before the lock", async () => {
      const template = createTemplateRow({ visibility: "private" });
      const locked = { ...template, visibility: "public" as const, isPublic: true };
      const { service, repository } = setup({ template, locked });

      await expect(service.updateSettings(template.id, { title: "Official Llama" })).rejects.toMatchObject({ errorCode: "template_publish_checks_failed" });
      expect(repository.updateSettings).not.toHaveBeenCalled();
    });

    it.each([
      { shape: "an ordinary new title on a public template", visibility: "public" as const, patch: { title: "Llama 3.1 Chat" } },
      { shape: "a reserved word in the title of a private template", visibility: "private" as const, patch: { title: "Official Llama" } },
      { shape: "a reserved word in the title of an organization template", visibility: "organization" as const, patch: { title: "Official Llama" } },
      {
        shape: "a public template renamed while it is made private",
        visibility: "public" as const,
        patch: { title: "Official Llama", visibility: "private" as const }
      },
      { shape: "a public template whose title is left alone", visibility: "public" as const, patch: { summary: "Official summary" } }
    ])("allows $shape", async ({ visibility, patch }) => {
      const template = createTemplateRow({ visibility, isPublic: visibility === "public", title: "Official legacy title" });
      const { service, repository } = setup({ template });

      await service.updateSettings(template.id, patch);

      expect(repository.updateSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe("delete", () => {
    it("re-checks the locked template, then removes it as its owner in one transaction", async () => {
      const template = createTemplateRow();
      const { service, templateRemovalRepository, transactionSteps } = setup({ template });
      templateRemovalRepository.remove.mockImplementation(async () => {
        transactionSteps.push("remove");
      });

      await service.delete(template.id);

      expect(transactionSteps).toEqual(["begin", "findAndLockForWrite", "remove", "end"]);
      expect(templateRemovalRepository.remove).toHaveBeenCalledWith(template.id, "owner");
    });

    it("refuses a caller who may change the template but not delete it", async () => {
      const template = createTemplateRow();
      const { service, templateRemovalRepository } = setup({ template, rules: [UPDATE_RULE] });

      await expect(service.delete(template.id)).rejects.toMatchObject({ status: 403, message: "You cannot change this template" });
      expect(templateRemovalRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe.each<[string, (service: TemplateWriterService, id: string) => Promise<unknown>]>([
    ["appendVersion", (service, id) => service.appendVersion(id, { sdl: buildSdl(), askedValues: [], baseVersion: 1 })],
    ["updateSettings", (service, id) => service.updateSettings(id, { title: "Renamed" })],
    ["delete", (service, id) => service.delete(id)]
  ])("%s authorization", (_method, write) => {
    it("answers 404 rather than 403 for a template the caller cannot read", async () => {
      const { service, marketplaceTemplateService, repository, txService } = setup({ activeOrganizationId: faker.string.uuid(), rules: [] });
      const id = faker.string.uuid();
      marketplaceTemplateService.findReadable.mockRejectedValue(createError(404, "Template not found"));

      await expect(write(service, id)).rejects.toMatchObject({ status: 404 });
      expect(marketplaceTemplateService.findReadable).toHaveBeenCalledWith(id);
      expect(txService.transaction).not.toHaveBeenCalled();
      expectNothingWritten(repository);
    });

    it("refuses a writer whose active organization is not the template's, before checking rules", async () => {
      const template = createTemplateRow();
      const { service, repository, txService } = setup({ template, activeOrganizationId: faker.string.uuid(), rules: [] });

      await expect(write(service, template.id)).rejects.toMatchObject({
        status: 403,
        message: SWITCH_ORGANIZATION_MESSAGE,
        errorCode: "organization_forbidden"
      });
      expect(txService.transaction).not.toHaveBeenCalled();
      expectNothingWritten(repository);
    });

    it("refuses a writer without an active organization", async () => {
      const template = createTemplateRow();
      const { service, repository } = setup({ template, activeOrganizationId: null });

      await expect(write(service, template.id)).rejects.toMatchObject({ status: 403, message: SWITCH_ORGANIZATION_MESSAGE });
      expectNothingWritten(repository);
    });

    it("refuses a caller whose rules do not reach the template", async () => {
      const template = createTemplateRow();
      const { service, repository, txService } = setup({
        template,
        rules: [{ action: ["update", "delete"], subject: "Template", conditions: { projectId: faker.string.uuid() } }]
      });

      await expect(write(service, template.id)).rejects.toMatchObject({ status: 403, message: "You cannot change this template" });
      expect(txService.transaction).not.toHaveBeenCalled();
      expectNothingWritten(repository);
    });

    it("refuses the write when the template left the active organization after it was read", async () => {
      const template = createTemplateRow();
      const { service, repository, templateVersionRepository } = setup({ template, locked: { ...template, organizationId: faker.string.uuid() } });

      await expect(write(service, template.id)).rejects.toMatchObject({ status: 403, message: SWITCH_ORGANIZATION_MESSAGE });
      expect(repository.findAndLockForWrite).toHaveBeenCalledWith(template.id);
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      expectNothingWritten(repository);
    });

    it("refuses the write when the template moved outside the caller's rules after it was read", async () => {
      const template = createTemplateRow();
      const { service, repository, templateVersionRepository } = setup({
        template,
        locked: { ...template, projectId: faker.string.uuid() },
        rules: [{ action: ["update", "delete"], subject: "Template", conditions: { projectId: template.projectId } }]
      });

      await expect(write(service, template.id)).rejects.toMatchObject({ status: 403, message: "You cannot change this template" });
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      expectNothingWritten(repository);
    });

    it.each<[string, (template: MarketplaceTemplateRow) => MarketplaceTemplateRow | null]>([
      ["deleted", () => null],
      ["removed by moderation", template => ({ ...template, moderationStatus: "removed" })]
    ])("answers 404 when the template was %s after it was read", async (_case, lockedOf) => {
      const template = createTemplateRow();
      const { service, repository, templateVersionRepository } = setup({ template, locked: lockedOf(template) });

      await expect(write(service, template.id)).rejects.toMatchObject({ status: 404, message: "Template not found" });
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      expectNothingWritten(repository);
    });
  });

  function expectNothingWritten(repository: MarketplaceTemplateRepository) {
    expect(repository.mirrorVersion).not.toHaveBeenCalled();
    expect(repository.updateSettings).not.toHaveBeenCalled();
  }

  function buildSdl({
    env,
    envMapping,
    credentials,
    count = 2,
    storageSize = "1Gi"
  }: { env?: string[]; envMapping?: string[]; credentials?: string[]; count?: number; storageSize?: string } = {}) {
    return [
      "version: '2.0'",
      "services:",
      "  web:",
      "    image: nginx:1.25",
      ...(env ? ["    env:", ...env.map(entry => `      - ${entry}`)] : []),
      ...(envMapping ? ["    env:", ...envMapping.map(entry => `      ${entry}`)] : []),
      ...(credentials ? ["    credentials:", ...credentials.map(entry => `      ${entry}`)] : []),
      "    expose:",
      "      - port: 80",
      "        as: 80",
      "        to:",
      "          - global: true",
      "profiles:",
      "  compute:",
      "    web:",
      "      resources:",
      "        cpu:",
      "          units: 0.5",
      "        memory:",
      "          size: 512Mi",
      "        storage:",
      `          size: ${storageSize}`,
      "  placement:",
      "    dcloud:",
      "      pricing:",
      "        web:",
      "          denom: uakt",
      "          amount: 1000",
      "deployment:",
      "  web:",
      "    dcloud:",
      "      profile: web",
      `      count: ${count}`
    ].join("\n");
  }

  function buildAliasBomb() {
    const levels = Array.from({ length: 10 }, (_, level) =>
      level === 0
        ? `l0: &l0 [${Array(10).fill('"aaaaaaaaaa"').join(", ")}]`
        : `l${level}: &l${level} [${Array(10)
            .fill(`*l${level - 1}`)
            .join(", ")}]`
    );

    return [...levels, "services:", "  web:", "    image: *l9"].join("\n");
  }

  function textAskedValue(key: string): AskedValue {
    return { key, label: key, type: "text", required: false, bindings: [{ service: "web", env: key }] };
  }

  function secretAskedValue(key: string): AskedValue {
    return { key, label: key, type: "secret", required: true, bindings: [{ service: "web", env: key }] };
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
      sdl: buildSdl(),
      authorId: faker.string.uuid(),
      summary: null,
      icon: null,
      categories: [],
      visibility: "private",
      isListed: true,
      isOfficial: false,
      isFeatured: false,
      moderationStatus: "active",
      currentVersionId: faker.string.uuid(),
      publishedAt: null,
      removedAt: null,
      removedBy: null,
      importedRef: null,
      importedContentHash: null,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      authorUsername: faker.internet.userName(),
      publisher: null,
      ...overrides
    };
  }

  function createVersion(overrides: Partial<TemplateVersionOutput> = {}): TemplateVersionOutput {
    return {
      id: faker.string.uuid(),
      templateId: faker.string.uuid(),
      version: 1,
      sdl: buildSdl(),
      readme: null,
      askedValues: [],
      resources: null,
      imageDigests: {},
      status: "live",
      checkResults: null,
      changes: ["first_version"],
      holdReasons: null,
      reviewedAt: null,
      reviewNote: null,
      createdById: faker.string.uuid(),
      createdBy: null,
      createdAt: faker.date.recent(),
      ...overrides
    };
  }

  function setup(
    input: {
      rules?: RawRuleOf<MongoAbility>[];
      template?: MarketplaceTemplateRow;
      base?: TemplateVersionOutput | null;
      locked?: MarketplaceTemplateRow | null;
      activeOrganizationId?: string | null;
      checkResults?: PublishCheckResults;
      holdReasons?: TemplateVersionHoldReason[];
      rateLimitError?: Error;
    } = {}
  ) {
    const ability = createMongoAbility<MongoAbility>(input.rules ?? [CREATE_RULE, UPDATE_RULE, DELETE_RULE]);
    const user = mock<UserOutput>({ id: faker.string.uuid(), userId: `auth0|${faker.string.alphanumeric(24)}` });
    const authService = mock<AuthService>();
    authService.ability = ability;
    authService.currentUser = user;
    const repository = mock<MarketplaceTemplateRepository>();
    const writableRepository = mock<MarketplaceTemplateRepository>();
    repository.accessibleBy.mockReturnValue(writableRepository);
    writableRepository.createTemplate.mockResolvedValue(faker.string.uuid());
    const templateVersionRepository = mock<TemplateVersionRepository>();
    templateVersionRepository.appendVersion.mockResolvedValue(createVersion());
    const templateRemovalRepository = mock<TemplateRemovalRepository>();
    const marketplaceTemplateService = mock<MarketplaceTemplateService>();
    const template = input.template ?? createTemplateRow();
    marketplaceTemplateService.findReadable.mockResolvedValue(template);
    templateVersionRepository.findByTemplateAndVersion.mockResolvedValue(
      input.base === null ? undefined : input.base ?? createVersion({ templateId: template.id })
    );
    const transactionSteps: string[] = [];
    repository.findAndLockForWrite.mockImplementation(async () => {
      transactionSteps.push("findAndLockForWrite");
      return input.locked === null ? undefined : input.locked ?? template;
    });
    const activeOrganizationId = input.activeOrganizationId === undefined ? template.organizationId : input.activeOrganizationId;
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get
      .calledWith("ORGANIZATION_CONTEXT")
      .mockReturnValue(activeOrganizationId ? createOrganizationContext({ organizationId: activeOrganizationId }) : undefined);
    const deploymentProjectService = mock<DeploymentProjectService>();
    const sdlReferenceService = new SdlReferenceService();
    const createLogger: CreateLogger = () => mock<ReturnType<CreateLogger>>();
    const sdlService = new SdlService(mock<BillingConfig>(), mock<BlockedGpuService>(), sdlReferenceService, mock<DenomExchangeService>(), createLogger);
    const txService = mock<TxService>({
      transaction: vi.fn(async callback => {
        transactionSteps.push("begin");
        const result = await callback();
        transactionSteps.push("end");
        return result;
      })
    });
    const publishChecksService = mock<PublishChecksService>();
    publishChecksService.run.mockResolvedValue(input.checkResults ?? PASSED_CHECKS);
    const templateRateLimiterService = mock<TemplateRateLimiterService>();
    templateRateLimiterService.assertWithinLimits.mockImplementation(async () => {
      transactionSteps.push("assertWithinLimits");
      if (input.rateLimitError) throw input.rateLimitError;
    });
    const templatePublisherNotifierService = mock<TemplatePublisherNotifierService>();
    templatePublisherNotifierService.notifyVersionFailedChecks.mockImplementation(async () => {
      transactionSteps.push("notifyVersionFailedChecks");
    });
    templatePublisherNotifierService.notifyVersionHeld.mockImplementation(async () => {
      transactionSteps.push("notifyVersionHeld");
    });
    const templateVersionHoldService = mock<TemplateVersionHoldService>();
    templateVersionHoldService.findHoldReasons.mockResolvedValue(input.holdReasons ?? []);
    const templateImageDigestJobService = mock<TemplateImageDigestJobService>();
    const templateUsageService = mock<TemplateUsageService>();
    templateUsageService.recordFork.mockImplementation(async () => {
      transactionSteps.push("recordFork");
    });
    const service = new TemplateWriterService(
      repository,
      templateVersionRepository,
      templateRemovalRepository,
      marketplaceTemplateService,
      deploymentProjectService,
      new TemplateSdlValidatorService(sdlService, sdlReferenceService),
      new TemplateWriteAccessService(repository, marketplaceTemplateService, authService, executionContextService),
      publishChecksService,
      templateRateLimiterService,
      templatePublisherNotifierService,
      templateVersionHoldService,
      templateImageDigestJobService,
      templateUsageService,
      authService,
      txService,
      executionContextService
    );

    return {
      service,
      repository,
      writableRepository,
      templateVersionRepository,
      templateRemovalRepository,
      marketplaceTemplateService,
      deploymentProjectService,
      authService,
      txService,
      publishChecksService,
      templateRateLimiterService,
      templatePublisherNotifierService,
      templateVersionHoldService,
      templateImageDigestJobService,
      templateUsageService,
      user,
      transactionSteps
    };
  }
});
