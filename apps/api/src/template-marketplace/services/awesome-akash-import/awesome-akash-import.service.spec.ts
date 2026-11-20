import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { TxService } from "@src/core/services";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import type { TemplateGalleryService } from "@src/template/services/template-gallery/template-gallery.service";
import type { Template } from "@src/template/types/template";
import { hashImportedContent } from "@src/template-marketplace/lib/imported-template/imported-template";
import type { TemplateMarketplaceConfig } from "@src/template-marketplace/providers/config.provider";
import type { ImportedTemplateRepository, StoredImportedTemplate } from "@src/template-marketplace/repositories/imported-template/imported-template.repository";
import type { TemplatePublisherRepository } from "@src/template-marketplace/repositories/template-publisher/template-publisher.repository";
import type { TemplateVersionOutput, TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type { TemplateImageDigestJobService } from "@src/template-marketplace/services/template-image-digest-job/template-image-digest-job.service";
import type { TemplateSdlValidatorService } from "@src/template-marketplace/services/template-sdl-validator/template-sdl-validator.service";
import { AwesomeAkashImportService, IMPORTED_TEMPLATES_PER_BATCH } from "./awesome-akash-import.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const SDL = `version: "2.0"
services:
  web:
    image: nginx:1.27.0
    expose:
      - port: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;
const MIRRORED_HARDWARE = { cpu: 500, ram: 512 * 1024 * 1024, storage: 1024 * 1024 * 1024 };
const NOTHING_IMPORTED = { created: 0, newVersions: 0, updated: 0, relisted: 0, skipped: 0, leftModerated: 0, failed: 0, unlisted: 0 };

describe(AwesomeAkashImportService.name, () => {
  describe("when the import cannot run", () => {
    it("does nothing but say so while no organization is configured", async () => {
      const { service, logger, importedTemplateRepository, templateGalleryService } = setup({ organizationId: null });

      await service.run();

      expect(logger.info.mock.calls).toEqual([[{ event: "TEMPLATE_IMPORT_SKIPPED", reason: "not_configured" }]]);
      expect(importedTemplateRepository.findOwningOrganization).not.toHaveBeenCalled();
      expect(templateGalleryService.getGallerySummaryBuffer).not.toHaveBeenCalled();
    });

    it("does nothing but say so outside mainnet, which shares its database with the other networks", async () => {
      const { service, logger, importedTemplateRepository, templateGalleryService } = setup({ network: "sandbox" });

      await service.run();

      expect(logger.info.mock.calls).toEqual([[{ event: "TEMPLATE_IMPORT_SKIPPED", reason: "not_mainnet" }]]);
      expect(importedTemplateRepository.findOwningOrganization).not.toHaveBeenCalled();
      expect(templateGalleryService.getGallerySummaryBuffer).not.toHaveBeenCalled();
    });

    it("does nothing but name the organization when the configured one does not exist", async () => {
      const { service, logger, organizationId, importedTemplateRepository, templateGalleryService, templatePublisherRepository } = setup({
        isOrganizationGone: true
      });

      await service.run();

      expect(importedTemplateRepository.findOwningOrganization).toHaveBeenCalledWith(organizationId);
      expect(logger.info.mock.calls).toEqual([[{ event: "TEMPLATE_IMPORT_SKIPPED", reason: "organization_not_found", organizationId }]]);
      expect(templateGalleryService.getGallerySummaryBuffer).not.toHaveBeenCalled();
      expect(templatePublisherRepository.findOrCreate).not.toHaveBeenCalled();
    });

    it("writes nothing, and unlists nothing, when the gallery cannot be read", async () => {
      const error = new Error("ENOENT: no such file or directory");
      const { service, logger, importedTemplateRepository, templatePublisherRepository, templateGalleryService } = setup({
        stored: [createStored()]
      });
      templateGalleryService.getGallerySummaryBuffer.mockRejectedValue(error);

      await service.run();

      expect(logger.error.mock.calls).toEqual([[{ event: "TEMPLATE_IMPORT_SKIPPED", reason: "gallery_unavailable", error }]]);
      expect(logger.info).not.toHaveBeenCalled();
      expect(templatePublisherRepository.findOrCreate).not.toHaveBeenCalled();
      expect(importedTemplateRepository.listAll).not.toHaveBeenCalled();
      expect(importedTemplateRepository.unlist).not.toHaveBeenCalled();
    });

    it("writes nothing, and unlists nothing, when the gallery lists no template", async () => {
      const { service, logger, importedTemplateRepository, templatePublisherRepository } = setup({ gallery: [], stored: [createStored()] });

      await service.run();

      expect(logger.info.mock.calls).toEqual([[{ event: "TEMPLATE_IMPORT_SKIPPED", reason: "gallery_empty" }]]);
      expect(templatePublisherRepository.findOrCreate).not.toHaveBeenCalled();
      expect(importedTemplateRepository.unlist).not.toHaveBeenCalled();
    });
  });

  describe("when a gallery template was never imported", () => {
    it("creates it as the gallery serves it, with a first live version whose image digests are resolved, under a publisher named after the organization", async () => {
      const template = createGalleryTemplate({ id: "akash-network-awesome-akash-comfyui", name: "ComfyUI", summary: "Node based UI" });
      const {
        service,
        logger,
        organizationId,
        importedTemplateRepository,
        templateVersionRepository,
        templatePublisherRepository,
        templateImageDigestJobService
      } = setup({ gallery: [{ template, categories: ["AI - GPU", "Tools"] }] });

      await service.run();

      expect(templatePublisherRepository.findOrCreate).toHaveBeenCalledWith(organizationId, expect.arrayContaining(["akash"]));
      expect(templatePublisherRepository.findOrCreate.mock.calls[0][1][0]).toBe("akash");
      expect(importedTemplateRepository.create.mock.calls).toEqual([
        [
          {
            organizationId,
            importedRef: "akash-network-awesome-akash-comfyui",
            importedContentHash: hashImportedContent({ sdl: SDL, readme: template.readme, githubUrl: template.githubUrl }),
            title: "ComfyUI",
            summary: "Node based UI",
            icon: "box",
            categories: ["AI - GPU", "Tools"],
            sdl: SDL,
            description: template.readme,
            ...MIRRORED_HARDWARE
          }
        ]
      ]);
      expect(templateVersionRepository.appendVersion.mock.calls).toEqual([
        [
          {
            templateId: "created-akash-network-awesome-akash-comfyui",
            sdl: SDL,
            readme: template.readme,
            askedValues: [],
            resources: { cpu: 0.5, memoryBytes: 512 * 1024 * 1024, storageBytes: 1024 * 1024 * 1024 }
          }
        ]
      ]);
      expect(templateImageDigestJobService.schedule.mock.calls).toEqual([["version-of-created-akash-network-awesome-akash-comfyui"]]);
      expect(importedTemplateRepository.unlist).toHaveBeenCalledWith([]);
      expect(logger.info.mock.calls).toEqual([[{ event: "TEMPLATES_IMPORTED", gallery: 1, ...NOTHING_IMPORTED, created: 1 }]]);
    });

    it("stores a template without a readme with an empty description and no resources its SDL does not tell", async () => {
      const template = createGalleryTemplate({ readme: "", deploy: "version: '2.0'\nservices:\n  web:\n    image: nginx:1.27.0\n" });
      const { service, importedTemplateRepository, templateVersionRepository } = setup({ gallery: [{ template }] });

      await service.run();

      expect(importedTemplateRepository.create).toHaveBeenCalledWith(expect.objectContaining({ description: "", cpu: 0, ram: 0, storage: 0 }));
      expect(templateVersionRepository.appendVersion).toHaveBeenCalledWith(expect.objectContaining({ readme: null, resources: null }));
    });

    it("skips a template whose SDL is not valid, saying why, and imports the others", async () => {
      const broken = createGalleryTemplate({ deploy: "services: [" });
      const sound = createGalleryTemplate();
      const { service, logger, importedTemplateRepository, templateSdlValidatorService, txService } = setup({
        gallery: [{ template: broken }, { template: sound }]
      });
      templateSdlValidatorService.findIssues.mockImplementation(sdl => (sdl === broken.deploy ? ["The SDL could not be read"] : []));

      await service.run();

      expect(logger.warn.mock.calls).toEqual([[{ event: "TEMPLATE_IMPORT_TEMPLATE_SKIPPED", importedRef: broken.id, issues: ["The SDL could not be read"] }]]);
      expect(importedTemplateRepository.create.mock.calls.map(([created]) => created.importedRef)).toEqual([sound.id]);
      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith({ event: "TEMPLATES_IMPORTED", gallery: 2, ...NOTHING_IMPORTED, created: 1, skipped: 1 });
    });

    it("skips an SDL over the length a deployment accepts without parsing it, and imports one exactly at the limit", async () => {
      const tooLong = createGalleryTemplate({ deploy: "#".repeat(SDL_MAX_LENGTH + 1) });
      const longest = createGalleryTemplate({ deploy: "#".repeat(SDL_MAX_LENGTH) });
      const { service, logger, importedTemplateRepository, templateSdlValidatorService } = setup({
        gallery: [{ template: tooLong }, { template: longest }]
      });

      await service.run();

      expect(logger.warn.mock.calls).toEqual([[{ event: "TEMPLATE_IMPORT_TEMPLATE_SKIPPED", importedRef: tooLong.id, issues: ["The SDL is too long"] }]]);
      expect(templateSdlValidatorService.findIssues.mock.calls).toEqual([[longest.deploy]]);
      expect(importedTemplateRepository.create.mock.calls.map(([created]) => created.importedRef)).toEqual([longest.id]);
    });

    it("skips a template the gallery lists without content", async () => {
      const listed = createGalleryTemplate();
      const { service, logger, importedTemplateRepository, templateGalleryService } = setup({ gallery: [{ template: listed }] });
      templateGalleryService.getTemplateById.mockResolvedValue(null);

      await service.run();

      expect(logger.warn.mock.calls).toEqual([
        [{ event: "TEMPLATE_IMPORT_TEMPLATE_SKIPPED", importedRef: listed.id, issues: ["The gallery holds no content for this template"] }]
      ]);
      expect(importedTemplateRepository.create).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "TEMPLATES_IMPORTED", gallery: 1, ...NOTHING_IMPORTED, skipped: 1 });
    });

    it("writes no version and counts nothing for a gallery id another run created meanwhile", async () => {
      const { service, logger, importedTemplateRepository, templateVersionRepository, templateImageDigestJobService } = setup({
        gallery: [{ template: createGalleryTemplate() }]
      });
      importedTemplateRepository.create.mockResolvedValue(undefined);

      await service.run();

      expect(importedTemplateRepository.create).toHaveBeenCalledTimes(1);
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      expect(templateImageDigestJobService.schedule).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "TEMPLATES_IMPORTED", gallery: 1, ...NOTHING_IMPORTED });
    });

    it("keeps importing after a template that fails, and says which one failed", async () => {
      const [first, failing, last] = [createGalleryTemplate(), createGalleryTemplate(), createGalleryTemplate()];
      const error = new Error("connection reset");
      const { service, logger, importedTemplateRepository } = setup({ gallery: [{ template: first }, { template: failing }, { template: last }] });
      importedTemplateRepository.create.mockImplementation(async created => {
        if (created.importedRef === failing.id) throw error;

        return `created-${created.importedRef}`;
      });

      await service.run();

      expect(logger.error.mock.calls).toEqual([[{ event: "TEMPLATE_IMPORT_TEMPLATE_FAILED", importedRef: failing.id, error }]]);
      expect(logger.info).toHaveBeenCalledWith({ event: "TEMPLATES_IMPORTED", gallery: 3, ...NOTHING_IMPORTED, created: 2, failed: 1 });
    });

    it("imports a gallery larger than a batch whole and in order, letting other work run between batches", async () => {
      const templates = Array.from({ length: IMPORTED_TEMPLATES_PER_BATCH + 1 }, () => createGalleryTemplate());
      const { service, logger, importedTemplateRepository } = setup({ gallery: templates.map(template => ({ template })) });
      const createdWhenOtherWorkRan: number[] = [];
      setImmediate(() => createdWhenOtherWorkRan.push(importedTemplateRepository.create.mock.calls.length));

      await service.run();

      expect(importedTemplateRepository.create.mock.calls.map(([created]) => created.importedRef)).toEqual(templates.map(template => template.id));
      expect(createdWhenOtherWorkRan).toEqual([IMPORTED_TEMPLATES_PER_BATCH]);
      expect(logger.info).toHaveBeenCalledWith({
        event: "TEMPLATES_IMPORTED",
        gallery: IMPORTED_TEMPLATES_PER_BATCH + 1,
        ...NOTHING_IMPORTED,
        created: IMPORTED_TEMPLATES_PER_BATCH + 1
      });
    });
  });

  describe("when a gallery template is already imported", () => {
    it("reads and writes nothing more for a template stored as the gallery serves it", async () => {
      const template = createGalleryTemplate();
      const stored = createStored({ template, categories: ["Tools"] });
      const { service, logger, importedTemplateRepository, templateVersionRepository, txService } = setup({
        gallery: [{ template, categories: ["Tools"] }],
        stored: [stored]
      });

      await service.run();

      expect(txService.transaction).not.toHaveBeenCalled();
      expect(importedTemplateRepository.findAndLock).not.toHaveBeenCalled();
      expect(importedTemplateRepository.update).not.toHaveBeenCalled();
      expect(importedTemplateRepository.create).not.toHaveBeenCalled();
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      expect(importedTemplateRepository.unlist).toHaveBeenCalledWith([]);
      expect(logger.info.mock.calls).toEqual([[{ event: "TEMPLATES_IMPORTED", gallery: 1, ...NOTHING_IMPORTED }]]);
    });

    it("saves a new live version when the SDL changed, and mirrors it on the template with its hash", async () => {
      const template = createGalleryTemplate();
      const stored = createStored({ template, importedContentHash: "0".repeat(64) });
      const { service, logger, importedTemplateRepository, templateVersionRepository, templateImageDigestJobService } = setup({
        gallery: [{ template }],
        stored: [stored]
      });

      await service.run();

      expect(importedTemplateRepository.findAndLock).toHaveBeenCalledWith(stored.id);
      expect(templateVersionRepository.appendVersion.mock.calls).toEqual([
        [{ templateId: stored.id, sdl: SDL, readme: template.readme, askedValues: [], resources: expect.objectContaining({ cpu: 0.5 }) }]
      ]);
      expect(templateImageDigestJobService.schedule.mock.calls).toEqual([[`version-of-${stored.id}`]]);
      expect(importedTemplateRepository.update.mock.calls).toEqual([
        [
          stored.id,
          {
            importedContentHash: hashImportedContent({ sdl: SDL, readme: template.readme, githubUrl: template.githubUrl }),
            sdl: SDL,
            description: template.readme,
            ...MIRRORED_HARDWARE
          }
        ]
      ]);
      expect(logger.info).toHaveBeenCalledWith({ event: "TEMPLATES_IMPORTED", gallery: 1, ...NOTHING_IMPORTED, newVersions: 1 });
    });

    it.each<[string, Partial<Template>, string[], object]>([
      ["title", { name: "Renamed" }, ["Tools"], { title: "Renamed" }],
      ["summary", { summary: "Another summary" }, ["Tools"], { summary: "Another summary" }],
      ["categories", {}, ["Hosting"], { categories: ["Hosting"] }]
    ])("writes a changed %s in place, with no new version", async (_field, changed, categories, update) => {
      const template = createGalleryTemplate();
      const stored = createStored({ template, categories: ["Tools"] });
      const { service, logger, importedTemplateRepository, templateVersionRepository } = setup({
        gallery: [{ template: { ...template, ...changed }, categories }],
        stored: [stored]
      });

      await service.run();

      expect(importedTemplateRepository.update.mock.calls).toEqual([[stored.id, update]]);
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "TEMPLATES_IMPORTED", gallery: 1, ...NOTHING_IMPORTED, updated: 1 });
    });

    it("lists again a template that came back to the gallery", async () => {
      const template = createGalleryTemplate();
      const stored = createStored({ template, isListed: false });
      const { service, logger, importedTemplateRepository } = setup({ gallery: [{ template }], stored: [stored] });

      await service.run();

      expect(importedTemplateRepository.update.mock.calls).toEqual([[stored.id, { isListed: true }]]);
      expect(importedTemplateRepository.unlist).toHaveBeenCalledWith([]);
      expect(logger.info).toHaveBeenCalledWith({ event: "TEMPLATES_IMPORTED", gallery: 1, ...NOTHING_IMPORTED, relisted: 1 });
    });

    it("keeps the current version and still renames a template whose new SDL is not valid", async () => {
      const template = createGalleryTemplate({ name: "Renamed" });
      const stored = createStored({ template, title: "Old name", importedContentHash: "0".repeat(64) });
      const { service, logger, importedTemplateRepository, templateVersionRepository, templateSdlValidatorService } = setup({
        gallery: [{ template }],
        stored: [stored]
      });
      templateSdlValidatorService.findIssues.mockReturnValue(["The SDL defines no services"]);

      await service.run();

      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      expect(importedTemplateRepository.update.mock.calls).toEqual([[stored.id, { title: "Renamed" }]]);
      expect(logger.warn.mock.calls).toEqual([
        [{ event: "TEMPLATE_IMPORT_TEMPLATE_SKIPPED", importedRef: template.id, issues: ["The SDL defines no services"] }]
      ]);
      expect(logger.info).toHaveBeenCalledWith({ event: "TEMPLATES_IMPORTED", gallery: 1, ...NOTHING_IMPORTED, skipped: 1, updated: 1 });
    });

    it("writes nothing for a template whose only change is an SDL that is not valid, and validates no SDL that did not change", async () => {
      const [unsound, renamed] = [createGalleryTemplate(), createGalleryTemplate({ name: "Renamed" })];
      const stored = [createStored({ template: unsound, importedContentHash: "0".repeat(64) }), createStored({ template: renamed, title: "Old name" })];
      const { service, importedTemplateRepository, templateSdlValidatorService } = setup({
        gallery: [{ template: unsound }, { template: renamed }],
        stored
      });
      templateSdlValidatorService.findIssues.mockReturnValue(["The SDL defines no services"]);

      await service.run();

      expect(templateSdlValidatorService.findIssues).toHaveBeenCalledTimes(1);
      expect(importedTemplateRepository.update.mock.calls).toEqual([[stored[1].id, { title: "Renamed" }]]);
    });

    it.each(["hidden", "removed"] as const)("leaves a template staff %s as it is, without reading its gallery content", async moderationStatus => {
      const template = createGalleryTemplate({ name: "Renamed" });
      const stored = createStored({ template, title: "Old name", moderationStatus, importedContentHash: null, isListed: false });
      const { service, logger, importedTemplateRepository, templateGalleryService, txService } = setup({ gallery: [{ template }], stored: [stored] });

      await service.run();

      expect(templateGalleryService.getTemplateById).not.toHaveBeenCalled();
      expect(txService.transaction).not.toHaveBeenCalled();
      expect(importedTemplateRepository.update).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "TEMPLATES_IMPORTED", gallery: 1, ...NOTHING_IMPORTED, leftModerated: 1 });
    });

    it.each<[string, Partial<StoredImportedTemplate> | null]>([
      ["staff hid it", { moderationStatus: "hidden" }],
      ["it is gone", null]
    ])("leaves a template alone when %s between the listing and the write", async (_case, locked) => {
      const template = createGalleryTemplate({ name: "Renamed" });
      const stored = createStored({ template, title: "Old name" });
      const { service, logger, importedTemplateRepository, templateVersionRepository } = setup({ gallery: [{ template }], stored: [stored] });
      importedTemplateRepository.findAndLock.mockResolvedValue(locked ? { ...stored, ...locked } : undefined);

      await service.run();

      expect(importedTemplateRepository.update).not.toHaveBeenCalled();
      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "TEMPLATES_IMPORTED", gallery: 1, ...NOTHING_IMPORTED, leftModerated: 1 });
    });

    it("writes nothing for a template another run brought up to date between the listing and the write", async () => {
      const template = createGalleryTemplate();
      const stored = createStored({ template, importedContentHash: "0".repeat(64) });
      const { service, logger, importedTemplateRepository, templateVersionRepository } = setup({ gallery: [{ template }], stored: [stored] });
      importedTemplateRepository.findAndLock.mockResolvedValue(createStored({ template }));

      await service.run();

      expect(templateVersionRepository.appendVersion).not.toHaveBeenCalled();
      expect(importedTemplateRepository.update).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "TEMPLATES_IMPORTED", gallery: 1, ...NOTHING_IMPORTED });
    });
  });

  describe("when an imported template left the gallery", () => {
    it("unlists the ones still listed and counts what the repository took out", async () => {
      const kept = createGalleryTemplate();
      const stored = [createStored({ template: kept }), createStored(), createStored({ isListed: false }), createStored()];
      const { service, logger, importedTemplateRepository } = setup({ gallery: [{ template: kept }], stored });
      importedTemplateRepository.unlist.mockResolvedValue(1);

      await service.run();

      expect(importedTemplateRepository.unlist.mock.calls).toEqual([[[stored[1].id, stored[3].id]]]);
      expect(logger.info).toHaveBeenCalledWith({ event: "TEMPLATES_IMPORTED", gallery: 1, ...NOTHING_IMPORTED, unlisted: 1 });
    });
  });

  function createGalleryTemplate(overrides: Partial<Template> = {}): Template {
    const id = `akash-network-awesome-akash-${faker.string.alphanumeric(12)}`;

    return {
      id,
      name: faker.commerce.productName(),
      path: id,
      readme: `# ${faker.lorem.words(3)}`,
      summary: faker.lorem.sentence(),
      logoUrl: "",
      deploy: SDL,
      githubUrl: `https://github.com/akash-network/awesome-akash/blob/${faker.git.commitSha()}/${id}`,
      persistentStorageEnabled: false,
      config: {},
      ...overrides
    };
  }

  function createStored({
    template = createGalleryTemplate(),
    ...overrides
  }: Partial<StoredImportedTemplate> & { template?: Template } = {}): StoredImportedTemplate {
    return {
      id: faker.string.uuid(),
      importedRef: template.id,
      title: template.name,
      summary: template.summary,
      categories: ["Uncategorized"],
      isListed: true,
      moderationStatus: "active",
      importedContentHash: hashImportedContent({ sdl: template.deploy, readme: template.readme, githubUrl: template.githubUrl }),
      hasStaffCategories: false,
      ...overrides
    };
  }

  function setup(
    input: {
      organizationId?: string | null;
      network?: "mainnet" | "sandbox" | "testnet";
      isOrganizationGone?: boolean;
      gallery?: { template: Template; categories?: string[] }[];
      stored?: StoredImportedTemplate[];
    } = {}
  ) {
    const organizationId = input.organizationId === null ? undefined : input.organizationId ?? faker.string.uuid();
    const gallery = input.gallery ?? [{ template: createGalleryTemplate() }];
    const categories = [...new Set(gallery.flatMap(listed => listed.categories ?? ["Uncategorized"]))].map(title => ({
      title,
      templates: gallery.filter(listed => (listed.categories ?? ["Uncategorized"]).includes(title)).map(({ template }) => ({ id: template.id }))
    }));
    const templateGalleryService = mock<TemplateGalleryService>();
    templateGalleryService.getGallerySummaryBuffer.mockResolvedValue(Buffer.from(JSON.stringify({ data: categories })));
    templateGalleryService.getTemplateById.mockImplementation(async id => gallery.find(({ template }) => template.id === id)?.template ?? null);
    const stored = input.stored ?? [];
    const importedTemplateRepository = mock<ImportedTemplateRepository>();
    importedTemplateRepository.findOwningOrganization.mockResolvedValue(
      input.isOrganizationGone ? undefined : { name: "Akash", slug: "akash", type: "team", ownerUsername: "sam" }
    );
    importedTemplateRepository.listAll.mockResolvedValue(stored);
    importedTemplateRepository.create.mockImplementation(async created => `created-${created.importedRef}`);
    importedTemplateRepository.findAndLock.mockImplementation(async id => stored.find(template => template.id === id));
    importedTemplateRepository.unlist.mockResolvedValue(0);
    const templateVersionRepository = mock<TemplateVersionRepository>();
    templateVersionRepository.appendVersion.mockImplementation(async ({ templateId }) => mock<TemplateVersionOutput>({ id: `version-of-${templateId}` }));
    const templatePublisherRepository = mock<TemplatePublisherRepository>();
    const templateSdlValidatorService = mock<TemplateSdlValidatorService>();
    templateSdlValidatorService.findIssues.mockReturnValue([]);
    const templateImageDigestJobService = mock<TemplateImageDigestJobService>();
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const coreConfig = mockConfigService<CoreConfigService>({ NETWORK: input.network ?? "mainnet" });
    const config = mock<TemplateMarketplaceConfig>({ TEMPLATE_IMPORT_ORGANIZATION_ID: organizationId });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new AwesomeAkashImportService(
      templateGalleryService,
      importedTemplateRepository,
      templateVersionRepository,
      templatePublisherRepository,
      templateSdlValidatorService,
      templateImageDigestJobService,
      txService,
      coreConfig,
      config,
      createLogger
    );

    return {
      service,
      organizationId,
      logger,
      templateGalleryService,
      importedTemplateRepository,
      templateVersionRepository,
      templatePublisherRepository,
      templateSdlValidatorService,
      templateImageDigestJobService,
      txService
    };
  }
});
