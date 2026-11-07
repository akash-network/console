import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TemplateVersionSummary } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type {
  MarketplaceTemplateOutput,
  MarketplaceTemplateService,
  PublishedTemplateVersion
} from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import type { TemplateWriterService } from "@src/template-marketplace/services/template-writer/template-writer.service";
import { MarketplaceTemplateController } from "./marketplace-template.controller";

describe(MarketplaceTemplateController.name, () => {
  describe("getTemplate", () => {
    it("answers the template with ISO dates and a current version without its creator's internal id", async () => {
      const version = createVersion();
      const template = createTemplate({ currentVersion: version });
      const { controller, service } = setup();
      service.getTemplate.mockResolvedValue(template);

      const result = await controller.getTemplate(template.id);

      expect(result).toEqual({
        data: {
          ...template,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
          currentVersion: publishedVersionOf(version)
        }
      });
      expect(service.getTemplate).toHaveBeenCalledWith(template.id);
    });

    it("answers a template without a current version", async () => {
      const template = createTemplate({ currentVersion: null });
      const { controller, service } = setup();
      service.getTemplate.mockResolvedValue(template);

      const result = await controller.getTemplate(template.id);

      expect(result.data.currentVersion).toBeNull();
    });
  });

  describe("listVersions", () => {
    it("answers the version summaries with ISO dates and without their creators' internal ids", async () => {
      const templateId = faker.string.uuid();
      const summaries: TemplateVersionSummary[] = [2, 1].map(version => {
        const { sdl: _sdl, readme: _readme, askedValues: _askedValues, ...summary } = createVersion({ templateId, version });
        return summary;
      });
      const { controller, service } = setup();
      service.listVersions.mockResolvedValue(summaries);

      const result = await controller.listVersions(templateId);

      expect(result).toEqual({ data: summaries.map(publishedVersionOf) });
      expect(service.listVersions).toHaveBeenCalledWith(templateId);
    });
  });

  describe("getVersion", () => {
    it("answers the version with an ISO date and without its creator's internal id", async () => {
      const version = createVersion({ version: 4 });
      const { controller, service } = setup();
      service.getVersion.mockResolvedValue(version);

      const result = await controller.getVersion(version.templateId, 4);

      expect(result).toEqual({ data: publishedVersionOf(version) });
      expect(service.getVersion).toHaveBeenCalledWith(version.templateId, 4);
    });
  });

  describe("createTemplate", () => {
    it("creates the template and answers it with ISO dates", async () => {
      const template = createTemplate({ visibility: "private" });
      const { controller, writer } = setup();
      writer.create.mockResolvedValue(template);
      const data = { title: "Web", sdl: "version: '2.0'", askedValues: [], projectId: faker.string.uuid() };

      const result = await controller.createTemplate({ data });

      expect(result).toEqual({
        data: {
          ...template,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
          currentVersion: publishedVersionOf(template.currentVersion!)
        }
      });
      expect(writer.create).toHaveBeenCalledWith(data);
    });
  });

  describe("createVersion", () => {
    it("saves the version and answers it without its creator's internal id", async () => {
      const version = createVersion({ version: 2 });
      const { controller, writer } = setup();
      writer.appendVersion.mockResolvedValue(version);
      const data = { sdl: "version: '2.0'", readme: null, askedValues: [], baseVersion: 1 };

      const result = await controller.createVersion(version.templateId, { data });

      expect(result).toEqual({ data: publishedVersionOf(version) });
      expect(writer.appendVersion).toHaveBeenCalledWith(version.templateId, data);
    });
  });

  function publishedVersionOf<V extends { createdById: string | null; createdAt: Date }>({ createdById: _createdById, createdAt, ...version }: V) {
    return { ...version, createdAt: createdAt.toISOString() };
  }

  function createVersion(overrides: Partial<PublishedTemplateVersion> = {}): PublishedTemplateVersion {
    return {
      id: faker.string.uuid(),
      templateId: faker.string.uuid(),
      version: 1,
      sdl: "version: '2.0'",
      readme: faker.lorem.paragraph(),
      askedValues: [],
      resources: { cpu: 1, memoryBytes: 1024, storageBytes: 1024 },
      status: "live",
      changes: ["image_changed"],
      createdById: faker.string.uuid(),
      createdBy: { username: faker.internet.userName() },
      createdAt: faker.date.recent(),
      ...overrides
    };
  }

  function createTemplate(overrides: Partial<MarketplaceTemplateOutput> = {}): MarketplaceTemplateOutput {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.words(3),
      summary: null,
      icon: null,
      categories: [],
      visibility: "public",
      isListed: false,
      isOfficial: false,
      moderationStatus: "active",
      copiedFromId: null,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      author: { username: faker.internet.userName() },
      publisher: null,
      currentVersion: createVersion(),
      canEdit: false,
      ...overrides
    };
  }

  function setup() {
    const service = mock<MarketplaceTemplateService>();
    const writer = mock<TemplateWriterService>();
    const controller = new MarketplaceTemplateController(service, writer);

    return { controller, service, writer };
  }
});
