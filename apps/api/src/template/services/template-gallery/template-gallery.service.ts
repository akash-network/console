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

const DEFAULT_RECOMMENDED_TEMPLATE_IDS = new Set([
  "akash-network-awesome-akash-openclaw",
  "akash-network-awesome-akash-comfyui",
  "akash-network-awesome-akash-DeepSeek-V3.1",
  "akash-network-awesome-akash-DeepSeek-R1"
]);

const DEFAULT_MOST_POPULAR_TEMPLATE_IDS = new Set([
  "akash-network-awesome-akash-openclaw",
  "akash-network-awesome-akash-ssh-ubuntu",
  "akash-network-awesome-akash-comfyui",
  "akash-network-awesome-akash-DeepSeek-V3.1"
]);

const DEFAULT_CATEGORY_PRIORITY: Record<string, number> = {
  "AI - GPU": 0,
  "AI - CPU": 1,
  "Machine Learning": 2,
  Databases: 3,
  "Databases and Administration": 3,
  "CI/CD, DevOps": 4,
  Monitoring: 5,
  Blogging: 6,
  Business: 7,
  Chat: 8,
  "Data Analytics": 9,
  "Data Visualization": 9,
  Gaming: 10,
  Games: 10,
  "Game Servers": 10,
  Hosting: 11,
  Media: 12,
  Social: 13,
  Storage: 14,
  "Decentralized Storage": 14,
  Tools: 15,
  Benchmarking: 16,
  Blockchain: 17,
  "Built with Cosmos-SDK": 18,
  DeFi: 19
};

export type TemplateTagsConfig = {
  recommendedIds: Set<string>;
  popularIds: Set<string>;
  categoryPriority: Record<string, number>;
};

type Options = {
  githubPAT?: string;
  dataFolderPath: string;
  categoryProcessingConcurrency?: number;
  templateSourceProcessingConcurrency?: number;
  getTagsConfig?: () => TemplateTagsConfig;
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

    const config = this.#options.getTagsConfig?.() ?? {
      recommendedIds: DEFAULT_RECOMMENDED_TEMPLATE_IDS,
      popularIds: DEFAULT_MOST_POPULAR_TEMPLATE_IDS,
      categoryPriority: DEFAULT_CATEGORY_PRIORITY
    };

    for (const category of gallery) {
      for (const template of category.templates) {
        const tags: string[] = [];
        if (config.recommendedIds.has(template.id)) tags.push("recommended");
        if (config.popularIds.has(template.id)) tags.push("popular");
        if (tags.length > 0) {
          (template as Template & { tags?: string[] }).tags = tags;
        }
      }
    }

    gallery.sort((a, b) => {
      const priorityA = config.categoryPriority[a.title] ?? 999;
      const priorityB = config.categoryPriority[b.title] ?? 999;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.title.localeCompare(b.title);
    });

    for (const category of gallery) {
      category.templates.sort((a, b) => {
        const aTagged = config.recommendedIds.has(a.id) || config.popularIds.has(a.id);
        const bTagged = config.recommendedIds.has(b.id) || config.popularIds.has(b.id);
        if (aTagged !== bTagged) return aTagged ? -1 : 1;
        return (a.name || "").localeCompare(b.name || "");
      });
    }

    this.#logger.info({
      event: "TEMPLATE_GALLERY_CACHE_BUILD_STATS",
      categoryCount: gallery.length,
      categoryNames: gallery.map(c => c.title),
      totalTemplates: allTemplates.length,
      taggedRecommended: allTemplates.filter(t => config.recommendedIds.has(t.id)).length,
      taggedPopular: allTemplates.filter(t => config.popularIds.has(t.id)).length
    });

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
