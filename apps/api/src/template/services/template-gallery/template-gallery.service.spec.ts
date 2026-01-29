import { mock } from "jest-mock-extended";
import { z } from "zod";

import { cacheEngine } from "@src/caching/helpers";
import type { LoggerService } from "@src/core";
import type { Category, Template } from "../../types/template";
import type { TemplateFetcherService } from "../template-fetcher/template-fetcher.service";
import type { FileSystemApi, GalleriesCache } from "./template-gallery.service";
import { TemplateGalleryService } from "./template-gallery.service";

describe(TemplateGalleryService.name, () => {
  afterEach(() => {
    cacheEngine.clearAllKeyInCache();
  });

  describe("getTemplateGallery", () => {
    it("fetches templates from all repositories and merges them", async () => {
      const { service, templateFetcher } = setup();
      const awesomeAkashTemplates = [createCategory({ title: "AI", templates: [{ id: "ai-1" }] })];
      const omnibusTemplates = [createCategory({ title: "Blockchain", templates: [{ id: "blockchain-1" }] })];

      templateFetcher.fetchAwesomeAkashTemplates.mockResolvedValue(awesomeAkashTemplates);
      templateFetcher.fetchOmnibusTemplates.mockResolvedValue(omnibusTemplates);

      const result = await service.getTemplateGallery();

      expect(result).toHaveLength(2);
      expect(result.map(c => c.title)).toEqual(["Blockchain", "AI"]);
    });

    it("throws error when fetch fails", async () => {
      const { service, templateFetcher, logger } = setup();
      const error = new Error("Network error");

      templateFetcher.fetchAwesomeAkashTemplates.mockRejectedValue(error);

      await expect(service.getTemplateGallery()).rejects.toThrow("Network error");
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "GET_TEMPLATE_GALLERY_ERROR",
          message: "no fallback available"
        })
      );
    });

    it("returns cached templates from filesystem when cache file exists", async () => {
      const { service, templateFetcher, fsMock } = setup();
      const cachedTemplates = [createCategory({ title: "Cached", templates: [{ id: "cached-1" }] })];

      fsMock.access.mockResolvedValue(undefined);
      fsMock.readFile.mockResolvedValue(JSON.stringify(cachedTemplates));

      const result = await service.getTemplateGallery();

      expect(result[0].title).toBe("Cached");
      expect(templateFetcher.fetchAwesomeAkashTemplates).not.toHaveBeenCalled();
      expect(templateFetcher.fetchOmnibusTemplates).not.toHaveBeenCalled();
    });

    it("handles concurrent calls by sharing the same promise", async () => {
      const { service, templateFetcher } = setup();
      const templates = [createCategory({ title: "AI", templates: [{ id: "t1" }] })];

      templateFetcher.fetchAwesomeAkashTemplates.mockResolvedValue(templates);

      const [result1, result2, result3] = await Promise.all([service.getTemplateGallery(), service.getTemplateGallery(), service.getTemplateGallery()]);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      expect(templateFetcher.fetchAwesomeAkashTemplates).toHaveBeenCalledTimes(1);
      expect(templateFetcher.fetchOmnibusTemplates).toHaveBeenCalledTimes(1);
    });

    it("returns cached gallery on filesystem if github request for latest commit sha fails", async () => {
      const { service, templateFetcher, logger, fsMock } = setup();
      const error = new Error("Network error");
      const commitSha = "fallbacksha";

      templateFetcher.fetchLatestCommitSha.mockRejectedValue(error);
      fsMock.glob.mockImplementation(
        createAsyncGenerator([`/data/templates/akash-network-awesome-akash-${commitSha}.json`, `/data/templates/akash-network-awesome-akash-anothersha.json`])
      );
      fsMock.access.mockResolvedValue(undefined);
      fsMock.readFile.mockResolvedValue(JSON.stringify([]));

      await service.getTemplateGallery();

      expect(fsMock.readFile).toHaveBeenCalledWith(expect.stringContaining(`/data/templates/akash-network-awesome-akash-${commitSha}.json`), "utf8");
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "TEMPLATES_FALLBACK_LATEST_COMMIT_SHA_FOUND",
          commitSha
        })
      );
    });

    it("throws error when github request for latest commit sha fails and no cached files exist", async () => {
      const { service, templateFetcher, fsMock } = setup();
      const error = new Error("Network error");

      templateFetcher.fetchLatestCommitSha.mockRejectedValue(error);
      fsMock.glob.mockImplementation(createAsyncGenerator([]));
      fsMock.access.mockResolvedValue(undefined);
      fsMock.readFile.mockResolvedValue(JSON.stringify([]));

      await expect(service.getTemplateGallery()).rejects.toThrow("Network error");
    });
  });

  describe("getCachedTemplateGallery", () => {
    it("returns cached gallery from file", async () => {
      const { service, fsMock } = setup();
      const cache = createGalleriesCache({
        templates: [{ id: "t1", name: "Template 1" }],
        categories: [{ title: "AI" }]
      });

      fsMock.access.mockResolvedValue(undefined);
      fsMock.readFile.mockResolvedValue(serializeGalleriesCache(cache));

      const result = await service.getCachedTemplateGallery();

      expect(result.metadata).toEqual(cache.metadata);
      expect(result.categories).toBe(cache.categories);
      expect(result.templates).toBe(cache.templates);
    });

    it("throws error when cache file not found", async () => {
      const { service, fsMock } = setup();

      fsMock.access.mockRejectedValue(new Error("File not found"));

      await expect(service.getCachedTemplateGallery()).rejects.toThrow("Template gallery cache file not found");
    });

    it("caches result in memory on subsequent calls", async () => {
      const { service, fsMock } = setup();
      const cache = createGalleriesCache({
        templates: [{ id: "t1", name: "Template 1" }],
        categories: [{ title: "AI" }]
      });

      fsMock.access.mockResolvedValue(undefined);
      fsMock.readFile.mockResolvedValue(serializeGalleriesCache(cache));

      const firstResult = await service.getCachedTemplateGallery();
      const secondResult = await service.getCachedTemplateGallery();

      expect(firstResult).toBe(secondResult);
      expect(fsMock.readFile).toHaveBeenCalledTimes(1);
    });
  });

  describe("buildTemplateGalleryCache", () => {
    it("builds cache from template gallery and writes to file", async () => {
      const { service, templateFetcher, fsMock } = setup();
      const template = { id: "t1", name: "Template 1" } as Template;
      const templates = [createCategory({ title: "AI", templates: [template] })];
      const categoriesSchema = z.array(z.object({ title: z.string() }));

      templateFetcher.fetchAwesomeAkashTemplates.mockResolvedValue(templates);

      const result = await service.buildTemplateGalleryCache(categoriesSchema);

      expect(fsMock.writeFile).toHaveBeenCalledWith("/data/templates/templates-gallery.json", expect.any(String));
      expect(result.metadata.templatesRanges).toHaveProperty("t1");
      expect(result.categories).toContain('"title":"AI"');
    });
  });

  describe("getTemplateById", () => {
    it("returns template when found in cache", async () => {
      const { service, fsMock } = setup();
      const template = { id: "t1", name: "Template 1" };
      const cache = createGalleriesCache({
        templates: [template],
        categories: [{ title: "AI" }]
      });

      fsMock.access.mockResolvedValue(undefined);
      fsMock.readFile.mockResolvedValue(serializeGalleriesCache(cache));

      const result = await service.getTemplateById("t1");

      expect(result).toEqual(template);
    });

    it("returns null when template ID not found in cache", async () => {
      const { service, fsMock } = setup();
      const cache = createGalleriesCache({
        templates: [{ id: "t1", name: "Template 1" }],
        categories: [{ title: "AI" }]
      });

      fsMock.access.mockResolvedValue(undefined);
      fsMock.readFile.mockResolvedValue(serializeGalleriesCache(cache));

      const result = await service.getTemplateById("non-existent");

      expect(result).toBeNull();
    });

    it("caches parsed template in memory", async () => {
      const { service, fsMock } = setup();
      const template = { id: "t1", name: "Template 1" };
      const cache = createGalleriesCache({
        templates: [template],
        categories: [{ title: "AI" }]
      });

      fsMock.access.mockResolvedValue(undefined);
      fsMock.readFile.mockResolvedValue(serializeGalleriesCache(cache));

      const firstResult = await service.getTemplateById("t1");
      const secondResult = await service.getTemplateById("t1");

      expect(firstResult).toBe(secondResult);
    });

    it("returns null and logs error when template content is invalid JSON", async () => {
      const { service, fsMock, logger } = setup();
      const invalidCache: GalleriesCache = {
        metadata: {
          templatesRanges: { t1: [0, 10] },
          templatesOffset: 5
        },
        categories: "[]",
        templates: "invalid-json"
      };

      fsMock.access.mockResolvedValue(undefined);
      fsMock.readFile.mockResolvedValue(serializeGalleriesCache(invalidCache));

      const result = await service.getTemplateById("t1");

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "GET_TEMPLATE_BY_ID_ERROR",
          templateId: "t1"
        })
      );
    });
  });

  function setup() {
    const logger = mock<LoggerService>();
    const fsMock = mock<FileSystemApi>({
      access: jest.fn(() => Promise.reject(new Error("File not found")))
    });
    const dataFolderPath = "/data";

    const service = new TemplateGalleryService(logger, fsMock, {
      githubPAT: "test-pat",
      dataFolderPath
    });

    const templateFetcher = mock<TemplateFetcherService>({
      fetchLatestCommitSha: jest.fn(() => Promise.resolve("abc123")),
      fetchAwesomeAkashTemplates: jest.fn(() => Promise.resolve([])),
      fetchOmnibusTemplates: jest.fn(() => Promise.resolve([]))
    });

    // HACK: assigning private properties to the service object. will refactor later
    Object.assign(service, { templateFetcher });

    return {
      service,
      templateFetcher,
      logger,
      fsMock
    };
  }

  function createAsyncGenerator(items: string[]) {
    return async function* () {
      for (const item of items) {
        yield item;
      }
    } as unknown as FileSystemApi["glob"];
  }

  function createCategory(overrides: Partial<Omit<Category, "templates">> & { templates?: Array<{ id: string; name?: string }> }): Category {
    return {
      title: "Category",
      templateSources: [],
      ...overrides,
      templates: (overrides.templates || []) as Category["templates"]
    };
  }

  function createGalleriesCache(data: { templates: Array<{ id: string; name?: string }>; categories: Array<{ title: string }> }): GalleriesCache {
    const serializedTemplates = data.templates.map(t => JSON.stringify(t));
    const serializedCategories = JSON.stringify(data.categories);

    let offset = 0;
    const templatesRanges = data.templates.reduce(
      (acc, template, index) => {
        const serialized = serializedTemplates[index];
        acc[template.id] = [offset, offset + serialized.length];
        offset += serialized.length + 1;
        return acc;
      },
      {} as Record<string, [number, number]>
    );

    return {
      metadata: {
        templatesRanges,
        templatesOffset: serializedCategories.length + 1
      },
      categories: serializedCategories,
      templates: serializedTemplates.join("\n")
    };
  }

  function serializeGalleriesCache(cache: GalleriesCache): string {
    return `${JSON.stringify(cache.metadata)}\n${cache.categories}\n${cache.templates}`;
  }
});
