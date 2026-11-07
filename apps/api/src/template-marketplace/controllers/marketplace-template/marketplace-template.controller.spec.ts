import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TemplateVersionSummary } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type {
  MarketplaceTemplateOutput,
  MarketplaceTemplateService,
  PublishedTemplateVersion
} from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import { MarketplaceTemplateController } from "./marketplace-template.controller";

describe(MarketplaceTemplateController.name, () => {
  describe("getTemplate", () => {
    it("answers the template with its dates and its current version's date as ISO strings", async () => {
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
          currentVersion: { ...version, createdAt: version.createdAt.toISOString() }
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
    it("answers the version summaries with ISO dates", async () => {
      const templateId = faker.string.uuid();
      const summaries: TemplateVersionSummary[] = [2, 1].map(version => {
        const { sdl: _sdl, readme: _readme, askedValues: _askedValues, ...summary } = createVersion({ templateId, version });
        return summary;
      });
      const { controller, service } = setup();
      service.listVersions.mockResolvedValue(summaries);

      const result = await controller.listVersions(templateId);

      expect(result).toEqual({ data: summaries.map(summary => ({ ...summary, createdAt: summary.createdAt.toISOString() })) });
      expect(service.listVersions).toHaveBeenCalledWith(templateId);
    });
  });

  describe("getVersion", () => {
    it("answers the version with an ISO date", async () => {
      const version = createVersion({ version: 4 });
      const { controller, service } = setup();
      service.getVersion.mockResolvedValue(version);

      const result = await controller.getVersion(version.templateId, 4);

      expect(result).toEqual({ data: { ...version, createdAt: version.createdAt.toISOString() } });
      expect(service.getVersion).toHaveBeenCalledWith(version.templateId, 4);
    });
  });

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
      createdById: faker.string.uuid(),
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
    const controller = new MarketplaceTemplateController(service);

    return { controller, service };
  }
});
