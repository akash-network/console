import { Octokit } from "@octokit/rest";
import { constants as fsConstants, promises as fsp } from "node:fs";
import path from "node:path";

import { Memoize, reusePendingPromise } from "@src/caching/helpers";
import { LoggerService } from "@src/core";
import type { Category, FinalCategory, Template } from "@src/template/types/template";
import { REPOSITORIES, TemplateFetcherService } from "../template-fetcher/template-fetcher.service";
import type { MergedTemplateCategoriesResult } from "../template-processor/template-processor.service";
import { TemplateProcessorService } from "../template-processor/template-processor.service";

type Options = {
  githubPAT?: string;
  dataFolderPath: string;
  categoryProcessingConcurrency?: number;
  templateSourceProcessingConcurrency?: number;
};

export class TemplateGalleryService {
  private lastGalleryData: {
    categories: FinalCategory[];
    templatesIds: MergedTemplateCategoriesResult["templatesIds"];
  } | null = null;

  private readonly templateFetcher: TemplateFetcherService;
  private readonly templateProcessor: TemplateProcessorService;
  readonly #logger: LoggerService;
  readonly #fs: FileSystemApi;
  readonly #options: Options;

  constructor(logger: LoggerService, fs: FileSystemApi, options: Options) {
    this.#logger = logger;
    this.#fs = fs;
    this.templateProcessor = new TemplateProcessorService();
    this.templateFetcher = new TemplateFetcherService(this.templateProcessor, this.#logger, fetch, getOctokit(options.githubPAT), {
      categoryProcessingConcurrency: options.categoryProcessingConcurrency,
      templateSourceProcessingConcurrency: options.templateSourceProcessingConcurrency
    });
    this.#options = options;
    this.getTemplatesFromRepo = reusePendingPromise(this.getTemplatesFromRepo.bind(this), { getKey: options => options.repository });
    this.getTemplateById = reusePendingPromise(this.getTemplateById.bind(this), { getKey: id => id });
  }

  @Memoize({ ttlInSeconds: Infinity })
  async getTemplateGallery() {
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
      const categories = templateGallery.categories.map(({ templateSources, ...category }) => category);
      this.lastGalleryData = { categories, templatesIds: templateGallery.templatesIds };

      this.#logger.debug({
        event: "GET_TEMPLATE_GALLERY_END",
        githubRequestsRemaining: this.templateFetcher.githubRequestsRemaining,
        categoriesCount: templateGallery.categories.length
      });

      return this.lastGalleryData;
    } catch (error) {
      if (this.lastGalleryData) {
        this.#logger.error({
          event: "GET_TEMPLATE_GALLERY_ERROR",
          message: "Serving template gallery from last working version",
          error
        });
        return this.lastGalleryData;
      } else {
        this.#logger.error({
          event: "GET_TEMPLATE_GALLERY_ERROR",
          message: "no fallback available",
          error
        });
        throw error;
      }
    }
  }

  async getTemplateById(id: Required<Template>["id"]): Promise<Template | null> {
    const { templatesIds, categories } = await this.getTemplateGallery();
    if (!templatesIds[id]) return null;

    const { categoryIndex, templateIndex } = templatesIds[id];
    const template = categories[categoryIndex].templates?.[templateIndex];
    if (!template) return null;
    return template;
  }

  private async getTemplatesFromRepo({
    repository,
    fetchTemplates
  }: {
    repository: keyof typeof REPOSITORIES;
    fetchTemplates: (version: string) => Promise<Category[]>;
  }): Promise<Category[]> {
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
