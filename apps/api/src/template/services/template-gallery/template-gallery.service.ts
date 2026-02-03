import { Octokit } from "@octokit/rest";
import PromisePool from "@supercharge/promise-pool";
import { LRUCache } from "lru-cache";
import type { promises as fsp } from "node:fs";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import type z from "zod";

import type { LoggerService } from "@src/core";
import type { Category, FinalCategory, Template } from "@src/template/types/template";
import { reusePendingPromise } from "../../../caching/helpers.ts";
import { GitHubArchiveService } from "../github-archive/github-archive.service.ts";
import { REPOSITORIES, TemplateFetcherService } from "../template-fetcher/template-fetcher.service.ts";
import { TemplateProcessorService } from "../template-processor/template-processor.service.ts";

type Options = {
  githubPAT?: string;
  dataFolderPath: string;
  categoryProcessingConcurrency?: number;
  templateSourceProcessingConcurrency?: number;
};

export class TemplateGalleryService {
  #templatesSummaryCache: Promise<Buffer> | undefined;
  #parsedTemplates = new LRUCache<string, Template>({ max: 100 });

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
      ? new TemplateFetcherService(this.templateProcessor, this.#logger, getOctokit, new GitHubArchiveService(this.#logger), {
          githubPAT: options.githubPAT,
          categoryProcessingConcurrency: options.categoryProcessingConcurrency,
          templateSourceProcessingConcurrency: options.templateSourceProcessingConcurrency
        })
      : null;
    this.#options = options;
    this.#galleriesCachePath = `${options.dataFolderPath}/templates`;
    this.getTemplatesFromRepo = reusePendingPromise(this.getTemplatesFromRepo.bind(this), { getKey: options => `templates-from-repo-${options.repository}` });
    this.getTemplateById = reusePendingPromise(this.getTemplateById.bind(this), { getKey: id => `template-by-id-${id}` });
    this.getGallerySummaryBuffer = reusePendingPromise(this.getGallerySummaryBuffer.bind(this), { getKey: () => "cached-template-gallery" });
  }

  async getGallerySummaryBuffer(): Promise<Buffer> {
    this.#templatesSummaryCache ??= this.#fs.readFile(this.#summaryCachePath()).catch(error => {
      this.#templatesSummaryCache = undefined;
      throw error;
    });
    return this.#templatesSummaryCache;
  }

  async refreshCache(categoriesSchema: z.ZodSchema): Promise<void> {
    await this.buildTemplateGalleryCache(categoriesSchema);
    this.#templatesSummaryCache = undefined;
    this.#parsedTemplates.clear();
    this.templateFetcher?.clearArchiveCache();
  }

  async buildTemplateGalleryCache(categoriesSchema: z.ZodSchema): Promise<void> {
    const gallery = await this.getTemplateGallery();
    const allTemplates = gallery.reduce<Template[]>((templates, category) => {
      templates.push(...category.templates);
      return templates;
    }, []);

    await this.#fs.mkdir(`${this.#galleriesCachePath}/v1/templates`, { recursive: true });

    const summary = categoriesSchema.parse(gallery);
    await this.#fs.writeFile(this.#summaryCachePath(), JSON.stringify({ data: summary }));
    const { errors } = await PromisePool.for(allTemplates)
      .withConcurrency(100)
      .process(async template => {
        await this.#fs.writeFile(this.#templateCachePath(template.id), JSON.stringify({ data: template }));
      });

    if (errors.length > 0) {
      throw errors[0];
    }
  }

  #templateCachePath(templateId: string): string {
    return `${this.#galleriesCachePath}/v1/templates/${templateId}.json`;
  }

  #summaryCachePath(): string {
    return `${this.#galleriesCachePath}/v1/templates-list.json`;
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
      const [awesomeAkashTemplates, omnibusTemplates] = await Promise.all([
        this.getTemplatesFromRepo({
          repository: "awesome-akash",
          fetchTemplates: this.templateFetcher.fetchAwesomeAkashTemplates.bind(this.templateFetcher)
        }),
        this.getTemplatesFromRepo({
          repository: "cosmos-omnibus",
          fetchTemplates: this.templateFetcher.fetchOmnibusTemplates.bind(this.templateFetcher)
        })
      ]);

      const templateGallery = this.templateProcessor.mergeTemplateCategories(omnibusTemplates, awesomeAkashTemplates);
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
    if (this.#parsedTemplates.has(id)) return this.#parsedTemplates.get(id)!;

    try {
      const templateContent = await this.#fs.readFile(this.#templateCachePath(id), "utf8");
      const template = JSON.parse(templateContent).data;
      this.#parsedTemplates.set(id, template);
      return template;
    } catch (error) {
      this.#logger.error({
        event: "GET_TEMPLATE_BY_ID_ERROR",
        message: "Error parsing template content",
        templateId: id,
        error
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

function getOctokit(githubPAT: string | undefined, fetch = globalThis.fetch) {
  return new Octokit({
    auth: githubPAT,
    userAgent: "Console API",
    baseUrl: "https://api.github.com",
    request: {
      fetch
    }
  });
}

export interface FileSystemApi {
  glob: typeof fsp.glob;
  access: typeof fsp.access;
  readFile: typeof fsp.readFile;
  writeFile: typeof fsp.writeFile;
  mkdir: typeof fsp.mkdir;
}
