import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type {
  ListedTemplateVersion,
  MarketplaceTemplateOutput,
  MarketplaceTemplateService,
  PublishedTemplateVersion,
  UserTemplateListItem
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
          currentVersion: publishedVersionOf(version),
          usage: { ...template.usage, lastDeployedAt: template.usage.lastDeployedAt!.toISOString() }
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

    it("answers a template never deployed without a last deploy", async () => {
      const template = createTemplate({ usage: { deploys: 0, lastDeployedAt: null, stillUpAfter24h: null } });
      const { controller, service } = setup();
      service.getTemplate.mockResolvedValue(template);

      const result = await controller.getTemplate(template.id);

      expect(result.data.usage).toEqual({ deploys: 0, lastDeployedAt: null, stillUpAfter24h: null });
    });
  });

  describe("listVersions", () => {
    it("answers the version summaries with ISO dates and without their creators' internal ids", async () => {
      const templateId = faker.string.uuid();
      const summaries: ListedTemplateVersion[] = [2, 1].map(version => {
        const { sdl: _sdl, readme: _readme, askedValues: _askedValues, ...summary } = createVersion({ templateId, version });
        return { ...summary, deploys: version * 3 };
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
          currentVersion: publishedVersionOf(template.currentVersion!),
          usage: { ...template.usage, lastDeployedAt: template.usage.lastDeployedAt!.toISOString() }
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

  describe("listTemplates", () => {
    it("answers the organization's templates with ISO dates", async () => {
      const item = createListItem();
      const unversioned = createListItem({ currentVersion: null, lastEditedBy: null, usage: { deploys: 0, lastDeployedAt: null } });
      const { controller, service } = setup();
      service.listInOrganization.mockResolvedValue([item, unversioned]);
      const query = { visibility: "organization" as const, projectId: faker.string.uuid() };

      const result = await controller.listTemplates(query);

      expect(result).toEqual({
        data: [
          {
            ...item,
            updatedAt: item.updatedAt.toISOString(),
            currentVersion: { ...item.currentVersion, createdAt: item.currentVersion!.createdAt.toISOString() },
            usage: { deploys: item.usage.deploys, lastDeployedAt: item.usage.lastDeployedAt!.toISOString() }
          },
          { ...unversioned, updatedAt: unversioned.updatedAt.toISOString() }
        ]
      });
      expect(service.listInOrganization).toHaveBeenCalledWith(query);
    });
  });

  describe("updateTemplate", () => {
    it("updates the settings and answers the template with ISO dates", async () => {
      const template = createTemplate({ visibility: "organization" });
      const { controller, writer } = setup();
      writer.updateSettings.mockResolvedValue(template);
      const data = { title: "Renamed", visibility: "organization" as const };

      const result = await controller.updateTemplate(template.id, { data });

      expect(result).toEqual({
        data: {
          ...template,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
          currentVersion: publishedVersionOf(template.currentVersion!),
          usage: { ...template.usage, lastDeployedAt: template.usage.lastDeployedAt!.toISOString() }
        }
      });
      expect(writer.updateSettings).toHaveBeenCalledWith(template.id, data);
    });
  });

  describe("deleteTemplate", () => {
    it("deletes the template", async () => {
      const id = faker.string.uuid();
      const { controller, writer } = setup();

      await controller.deleteTemplate(id);

      expect(writer.delete).toHaveBeenCalledWith(id);
    });
  });

  function createListItem(overrides: Partial<UserTemplateListItem> = {}): UserTemplateListItem {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.words(3),
      summary: null,
      icon: "rocket",
      categories: ["Tools"],
      visibility: "organization",
      isListed: true,
      moderationStatus: "active",
      projectId: faker.string.uuid(),
      copiedFromId: null,
      updatedAt: faker.date.recent(),
      currentVersion: { version: 3, status: "live", createdAt: faker.date.recent() },
      lastEditedBy: { username: faker.internet.userName() },
      canEdit: true,
      usage: { deploys: faker.number.int({ min: 1, max: 100 }), lastDeployedAt: faker.date.recent() },
      ...overrides
    };
  }

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
      projectId: faker.string.uuid(),
      copiedFromId: null,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      author: { username: faker.internet.userName() },
      publisher: null,
      currentVersion: createVersion(),
      canEdit: false,
      isFavorite: false,
      usage: { deploys: faker.number.int({ min: 1, max: 100 }), lastDeployedAt: faker.date.recent(), stillUpAfter24h: 0.8 },
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
