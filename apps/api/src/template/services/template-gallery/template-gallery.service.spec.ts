import { mock } from "vitest-mock-extended";
import { z } from "zod";

import { cacheEngine } from "@src/caching/helpers";
import type { LoggerService } from "@src/core";
import type { Category, Template } from "../../types/template";
import type { TemplateFetcherService } from "../template-fetcher/template-fetcher.service";
import type { FileSystemApi } from "./template-gallery.service";
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

  describe("getGallerySummaryBuffer", () => {
    it("reads and returns summary buffer from file", async () => {
      const { service, fsMock } = setup();
      const summaryData = { data: [{ title: "AI" }] };
      const summaryBuffer = Buffer.from(JSON.stringify(summaryData));

      fsMock.readFile.mockResolvedValue(summaryBuffer);

      const result = await service.getGallerySummaryBuffer();

      expect(result).toEqual(summaryBuffer);
      expect(fsMock.readFile).toHaveBeenCalledWith("/data/templates/v1/templates-list.json");
    });

    it("caches result in memory on subsequent calls", async () => {
      const { service, fsMock } = setup();
      const summaryBuffer = Buffer.from(JSON.stringify({ data: [] }));

      fsMock.readFile.mockResolvedValue(summaryBuffer);

      const firstResult = await service.getGallerySummaryBuffer();
      const secondResult = await service.getGallerySummaryBuffer();

      expect(firstResult).toBe(secondResult);
      expect(fsMock.readFile).toHaveBeenCalledTimes(1);
    });
  });

  describe("refreshCache", () => {
    it("rebuilds cache and clears parsed templates", async () => {
      const { service, templateFetcher, fsMock } = setup();
      const template = { id: "t1", name: "Template 1" } as Template;
      const templates = [createCategory({ title: "AI", templates: [template] })];
      const categoriesSchema = z.array(z.object({ title: z.string() }));

      templateFetcher.fetchAwesomeAkashTemplates.mockResolvedValue(templates);
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.writeFile.mockResolvedValue(undefined);

      await service.refreshCache(categoriesSchema);

      expect(fsMock.writeFile).toHaveBeenCalledWith("/data/templates/v1/templates-list.json", expect.any(String));
    });

    it("clears template fetcher archive cache", async () => {
      const { service, templateFetcher, fsMock } = setup();
      const categoriesSchema = z.array(z.object({ title: z.string() }));

      templateFetcher.fetchAwesomeAkashTemplates.mockResolvedValue([]);
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.writeFile.mockResolvedValue(undefined);

      await service.refreshCache(categoriesSchema);

      expect(templateFetcher.clearArchiveCache).toHaveBeenCalled();
    });
  });

  describe("buildTemplateGalleryCache", () => {
    it("creates templates directory and writes summary file", async () => {
      const { service, templateFetcher, fsMock } = setup();
      const template = { id: "t1", name: "Template 1" } as Template;
      const templates = [createCategory({ title: "AI", templates: [template] })];
      const categoriesSchema = z.array(z.object({ title: z.string() }));

      templateFetcher.fetchAwesomeAkashTemplates.mockResolvedValue(templates);
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.writeFile.mockResolvedValue(undefined);

      await service.buildTemplateGalleryCache(categoriesSchema);

      expect(fsMock.mkdir).toHaveBeenCalledWith("/data/templates/v1/templates", { recursive: true });
      expect(fsMock.writeFile).toHaveBeenCalledWith("/data/templates/v1/templates-list.json", expect.stringContaining('"data"'));
    });

    it("writes individual template files", async () => {
      const { service, templateFetcher, fsMock } = setup();
      const template1 = { id: "t1", name: "Template 1" } as Template;
      const template2 = { id: "t2", name: "Template 2" } as Template;
      const templates = [createCategory({ title: "AI", templates: [template1, template2] })];
      const categoriesSchema = z.array(z.object({ title: z.string() }));

      templateFetcher.fetchAwesomeAkashTemplates.mockResolvedValue(templates);
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.writeFile.mockResolvedValue(undefined);

      await service.buildTemplateGalleryCache(categoriesSchema);

      expect(fsMock.writeFile).toHaveBeenCalledWith("/data/templates/v1/templates/t1.json", JSON.stringify({ data: template1 }));
      expect(fsMock.writeFile).toHaveBeenCalledWith("/data/templates/v1/templates/t2.json", JSON.stringify({ data: template2 }));
    });
  });

  describe("getTemplateById", () => {
    it("returns template when found in file", async () => {
      const { service, fsMock } = setup();
      const template = { id: "t1", name: "Template 1" };

      fsMock.readFile.mockResolvedValue(JSON.stringify({ data: template }));

      const result = await service.getTemplateById("t1");

      expect(result).toEqual(template);
      expect(fsMock.readFile).toHaveBeenCalledWith("/data/templates/v1/templates/t1.json", "utf8");
    });

    it("returns null when template file not found", async () => {
      const { service, fsMock, logger } = setup();

      fsMock.readFile.mockRejectedValue(new Error("File not found"));

      const result = await service.getTemplateById("non-existent");

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "GET_TEMPLATE_BY_ID_ERROR",
          templateId: "non-existent"
        })
      );
    });

    it("caches parsed template in memory", async () => {
      const { service, fsMock } = setup();
      const template = { id: "t1", name: "Template 1" };

      fsMock.readFile.mockResolvedValue(JSON.stringify({ data: template }));

      const firstResult = await service.getTemplateById("t1");
      const secondResult = await service.getTemplateById("t1");

      expect(firstResult).toBe(secondResult);
      expect(fsMock.readFile).toHaveBeenCalledTimes(1);
    });

    it("returns null and logs error when template content is invalid JSON", async () => {
      const { service, fsMock, logger } = setup();

      fsMock.readFile.mockResolvedValue("invalid-json");

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
      fetchOmnibusTemplates: jest.fn(() => Promise.resolve([])),
      clearArchiveCache: jest.fn()
    });

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
});
