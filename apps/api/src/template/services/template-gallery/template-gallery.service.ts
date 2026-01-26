import { Octokit } from "@octokit/rest";
import type { promises as fsp } from "node:fs";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import type z from "zod";

import { reusePendingPromise } from "@src/caching/helpers";
import type { LoggerService } from "@src/core";
import type { Category, FinalCategory, Template } from "@src/template/types/template";
import { REPOSITORIES, TemplateFetcherService } from "../template-fetcher/template-fetcher.service";
import { TemplateProcessorService } from "../template-processor/template-processor.service";

type Options = {
  githubPAT?: string;
  dataFolderPath: string;
  categoryProcessingConcurrency?: number;
  templateSourceProcessingConcurrency?: number;
};

export class TemplateGalleryService {
  #galleriesCache: GalleriesCache | null = null;
  #parsedTemplates: Record<string, Template> = {};

  private readonly templateFetcher: TemplateFetcherService | null;
  private readonly templateProcessor: TemplateProcessorService;
  readonly #logger: LoggerService;
  readonly #fs: FileSystemApi;
  readonly #options: Options;
  readonly #galleriesCachePath: string;

  constructor(logger: LoggerService, fs: FileSystemApi, options: Options) {
    this.#logger = logger;
    this.#fs = fs;
    this.templateProcessor = new TemplateProcessorService();
    this.templateFetcher = options.githubPAT
      ? new TemplateFetcherService(this.templateProcessor, this.#logger, fetch, getOctokit(options.githubPAT), {
          categoryProcessingConcurrency: options.categoryProcessingConcurrency,
          templateSourceProcessingConcurrency: options.templateSourceProcessingConcurrency
        })
      : null;
    this.#options = options;
    this.#galleriesCachePath = `${options.dataFolderPath}/templates/templates-gallery.json`;
    this.getTemplatesFromRepo = reusePendingPromise(this.getTemplatesFromRepo.bind(this), { getKey: options => `templates-from-repo-${options.repository}` });
    this.getTemplateById = reusePendingPromise(this.getTemplateById.bind(this), { getKey: id => `template-by-id-${id}` });
    this.getCachedTemplateGallery = reusePendingPromise(this.getCachedTemplateGallery.bind(this), { getKey: () => "cached-template-gallery" });
  }

  async getCachedTemplateGallery(): Promise<GalleriesCache> {
    if (this.#galleriesCache) return this.#galleriesCache;

    const cacheFileExists = await this.#fs.access(this.#galleriesCachePath, fsConstants.W_OK | fsConstants.R_OK).then(
      () => true,
      () => false
    );

    if (!cacheFileExists) {
      throw new Error(`Template gallery cache file not found: ${this.#galleriesCachePath}`);
    }

    const cacheContent = await this.#fs.readFile(this.#galleriesCachePath, "utf8");
    const metadataString = cacheContent.slice(0, cacheContent.indexOf("\n"));
    const content = cacheContent.slice(metadataString.length + 1);
    const metadata = JSON.parse(metadataString);
    const categories = content.slice(0, metadata.templatesOffset).trim();
    const templates = content.slice(metadata.templatesOffset).trim();

    this.#galleriesCache = Object.freeze({
      metadata,
      categories,
      templates
    });
    return this.#galleriesCache;
  }

  async buildTemplateGalleryCache(categoriesSchema: z.ZodSchema): Promise<GalleriesCache> {
    const gallery = await this.getTemplateGallery();
    const result = gallery.reduce<{ templates: Template[]; categories: FinalCategory[] }>(
      (acc, category) => {
        acc.templates.push(...category.templates);
        acc.categories.push(category);
        return acc;
      },
      { templates: [], categories: [] }
    );

    result.categories = categoriesSchema.parse(result.categories);
    const serializedTemplates = result.templates.map(template => JSON.stringify(template));
    const templatesRangesByIndex = buildContentRanges(serializedTemplates);
    const templatesRangesById = result.templates.reduce(
      (acc, template, index) => {
        acc[template.id] = templatesRangesByIndex[index];
        return acc;
      },
      {} as Record<string, [start: number, end: number]>
    );
    const serializedCategoriesContent = JSON.stringify(result.categories);

    const metadata: GalleriesCache["metadata"] = {
      templatesRanges: templatesRangesById,
      templatesOffset: serializedCategoriesContent.length + 1 // +1 for the newline character
    };
    const serializeTemplatesContent = serializedTemplates.join("\n");
    const content = `${JSON.stringify(metadata)}\n${serializedCategoriesContent}\n${serializeTemplatesContent}`;

    await this.#fs.writeFile(this.#galleriesCachePath, content);

    return {
      metadata,
      categories: serializedCategoriesContent,
      templates: serializeTemplatesContent
    };
  }

  /**
   * !!! WARNING !!!
   * DO NOT USE THIS METHOD to serve requests, it's event loop blocking because works with big JSON objects.
   * Use getTemplateGallerySerialized instead.
   */
  async getTemplateGallery(): Promise<FinalCategory[]> {
    if (!this.templateFetcher) return [];

    try {
      this.#logger.debug({
        event: "GET_TEMPLATE_GALLERY_START",
        msg: "Getting template gallery"
      });
      const [awesomeAkashTemplates, omnibusTemplates, linuxServerTemplates] = await Promise.all([
        this.getTemplatesFromRepo({
          repository: "awesome-akash",
          fetchTemplates: this.templateFetcher.fetchAwesomeAkashTemplates.bind(this.templateFetcher)
        }),
        this.getTemplatesFromRepo({
          repository: "cosmos-omnibus",
          fetchTemplates: this.templateFetcher.fetchOmnibusTemplates.bind(this.templateFetcher)
        }),
        this.getTemplatesFromRepo({
          repository: "akash-linuxserver",
          fetchTemplates: this.templateFetcher.fetchLinuxServerTemplates.bind(this.templateFetcher)
        })
      ]);

      const templateGallery = this.templateProcessor.mergeTemplateCategories(omnibusTemplates, awesomeAkashTemplates, linuxServerTemplates);
      const categories = templateGallery.map(({ templateSources, ...category }) => category);

      this.#logger.debug({
        event: "GET_TEMPLATE_GALLERY_END",
        githubRequestsRemaining: this.templateFetcher.githubRequestsRemaining,
        categoriesCount: categories.length
      });

      return categories;
    } catch (error) {
      this.#logger.error({
        event: "GET_TEMPLATE_GALLERY_ERROR",
        message: "no fallback available",
        error
      });
      throw error;
    }
  }

  async getTemplateById(id: Required<Template>["id"]): Promise<Template | null> {
    if (Object.hasOwn(this.#parsedTemplates, id)) return this.#parsedTemplates[id];

    const { templates, metadata } = await this.getCachedTemplateGallery();
    if (!Object.hasOwn(metadata.templatesRanges, id)) return null;

    const [start, end] = metadata.templatesRanges[id];

    const templateContent = templates.slice(start, end).trim();

    try {
      this.#parsedTemplates[id] = JSON.parse(templateContent);
      return this.#parsedTemplates[id];
    } catch (error) {
      this.#logger.error({
        event: "GET_TEMPLATE_BY_ID_ERROR",
        message: "Error parsing template content",
        error,
        templateId: id,
        templateRange: metadata.templatesRanges[id],
        templatesSize: templates.length
      });
      return null;
    }
  }

  private async getTemplatesFromRepo({
    repository,
    fetchTemplates
  }: {
    repository: keyof typeof REPOSITORIES;
    fetchTemplates: (version: string) => Promise<Category[]>;
  }): Promise<Category[]> {
    if (!this.templateFetcher) return [];

    const { repoName, repoOwner } = REPOSITORIES[repository];
    const cachePathPrefix = `${this.#options.dataFolderPath}/templates/${repoOwner}-${repoName}`;
    const latestCommitSha = await this.templateFetcher.fetchLatestCommitSha(repository).catch(async error => {
      const files = await Array.fromAsync(this.#fs.glob(`${cachePathPrefix}-*.json`));
      this.#logger.debug({
        event: "UNABLE_TO_FETCH_LATEST_TEMPLATES_COMMIT_SHA",
        message: "Trying to use the latest cached version",
        path: cachePathPrefix,
        repository,
        filesThatMatch: files,
        error
      });
      if (!files.length) throw error;

      const latestCachedVersionSha = files[0].slice(path.normalize(cachePathPrefix).length + 1, -1 * ".json".length);
      this.#logger.debug({
        event: "TEMPLATES_FALLBACK_LATEST_COMMIT_SHA_FOUND",
        message: "Trying to use the latest cached version",
        repository,
        commitSha: latestCachedVersionSha
      });
      return latestCachedVersionSha;
    });
    const cacheFilePath = `${cachePathPrefix}-${latestCommitSha}.json`;
    const cacheFileExists = await this.#fs.access(cacheFilePath, fsConstants.R_OK).then(
      () => true,
      () => false
    );

    if (cacheFileExists) {
      this.#logger.debug({
        event: "GET_TEMPLATES_FROM_REPO_CACHE",
        message: "Returning cached templates from filesystem",
        path: cacheFilePath,
        repository
      });
      const fileContent = await this.#fs.readFile(cacheFilePath, "utf8");
      return JSON.parse(fileContent);
    } else {
      this.#logger.debug({
        event: "GET_TEMPLATES",
        message: "Generating templates from github repository",
        repository,
        commitSha: latestCommitSha
      });
      const categories = await fetchTemplates(latestCommitSha);
      await this.#fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
      await this.#fs.writeFile(cacheFilePath, JSON.stringify(categories, null, 2));

      return categories;
    }
  }
}

function getOctokit(githubPAT: string | undefined) {
  if (!githubPAT) {
    throw new Error("GITHUB_PAT is required to fetch akash templates from GitHub");
  }

  return new Octokit({
    auth: githubPAT,
    userAgent: "Console API",
    baseUrl: "https://api.github.com"
  });
}

export interface FileSystemApi {
  glob: typeof fsp.glob;
  access: typeof fsp.access;
  readFile: typeof fsp.readFile;
  writeFile: typeof fsp.writeFile;
  mkdir: typeof fsp.mkdir;
}

export interface GalleriesCache {
  metadata: {
    templatesRanges: Record<string, [start: number, end: number]>;
    templatesOffset: number;
  };
  categories: string;
  templates: string;
}

function buildContentRanges(content: string[]): Record<number, [start: number, end: number]> {
  let offset = 0;
  return content.reduce(
    (acc, chunk, index) => {
      acc[index] = [offset, offset + chunk.length];
      offset += chunk.length + 1; // +1 for the newline character
      return acc;
    },
    {} as Record<number, [start: number, end: number]>
  );
}
