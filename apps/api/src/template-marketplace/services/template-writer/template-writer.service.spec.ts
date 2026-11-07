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
import type {
  MarketplaceTemplateRepository,
  MarketplaceTemplateRow
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import type { TemplateVersionOutput, TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type {
  MarketplaceTemplateOutput,
  MarketplaceTemplateService
} from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import type { UserOutput } from "@src/user/repositories";
import { TemplateWriterService } from "./template-writer.service";

import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

const MEBIBYTE = 1024 ** 2;
const GIBIBYTE = 1024 ** 3;
const CREATE_RULE = { action: "create", subject: "Template" };
const UPDATE_RULE = { action: "update", subject: "Template" };
const DELETE_RULE = { action: "delete", subject: "Template" };
const SWITCH_ORGANIZATION_MESSAGE = "Switch to the template's organization to change it";

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
      expect(transactionSteps).toEqual(["begin", "createTemplate", "appendVersion", "end"]);
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

    it("refuses copying from a template the caller cannot read", async () => {
      const { service, writableRepository, marketplaceTemplateService } = setup();
      marketplaceTemplateService.findReadable.mockRejectedValue(createError(404, "Template not found"));

      await expect(service.create({ title: "Copy", sdl: buildSdl(), askedValues: [], copiedFromId: faker.string.uuid() })).rejects.toMatchObject({
        status: 404
      });
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

      const { imageDigests: _imageDigests, ...published } = appended;
      expect(result).toEqual(published);
      expect(transactionSteps).toEqual(["begin", "findAndLockForWrite", "appendVersion", "mirrorVersion", "end"]);
      expect(repository.findAndLockForWrite).toHaveBeenCalledWith(template.id);
      expect(templateVersionRepository.findByTemplateAndVersion).toHaveBeenCalledWith(template.id, 3);
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith({
        templateId: template.id,
        sdl,
        readme: "# After",
        askedValues,
        resources: { cpu: 1.5, memoryBytes: 1536 * MEBIBYTE, storageBytes: 3 * GIBIBYTE },
        createdById: user.id,
        expectedCurrentVersionId: base.id
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
  });

  describe("delete", () => {
    it("re-checks the locked template, then deletes it in one transaction", async () => {
      const template = createTemplateRow();
      const { service, repository, transactionSteps } = setup({ template });
      repository.deleteTemplate.mockImplementation(async () => {
        transactionSteps.push("deleteTemplate");
      });

      await service.delete(template.id);

      expect(transactionSteps).toEqual(["begin", "findAndLockForWrite", "deleteTemplate", "end"]);
      expect(repository.deleteTemplate).toHaveBeenCalledWith(template.id);
    });

    it("refuses a caller who may change the template but not delete it", async () => {
      const template = createTemplateRow();
      const { service, repository } = setup({ template, rules: [UPDATE_RULE] });

      await expect(service.delete(template.id)).rejects.toMatchObject({ status: 403, message: "You cannot change this template" });
      expect(repository.deleteTemplate).not.toHaveBeenCalled();
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

    it("refuses a template filed in no organization", async () => {
      const template = createTemplateRow({ organizationId: null });
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
    expect(repository.deleteTemplate).not.toHaveBeenCalled();
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
      changes: ["first_version"],
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
    const service = new TemplateWriterService(
      repository,
      templateVersionRepository,
      marketplaceTemplateService,
      deploymentProjectService,
      sdlService,
      sdlReferenceService,
      authService,
      txService,
      executionContextService
    );

    return {
      service,
      repository,
      writableRepository,
      templateVersionRepository,
      marketplaceTemplateService,
      deploymentProjectService,
      authService,
      txService,
      user,
      transactionSteps
    };
  }
});
