import type { Octokit } from "@octokit/rest";
import PromisePool from "@supercharge/promise-pool";

import type { LoggerService } from "@src/core";
import type { GithubChainRegistryChainResponse } from "@src/types";
import type { GithubDirectoryItem } from "@src/types/github";
import type { Category, TemplateSource } from "../../types/template.ts";
import type { GitHubArchiveService } from "../github-archive/github-archive.service.ts";
import type { TemplateProcessorService } from "../template-processor/template-processor.service.ts";

export const REPOSITORIES = {
  "awesome-akash": {
    repoOwner: "akash-network",
    repoName: "awesome-akash",
    mainBranch: "master"
  },
  "cosmos-omnibus": {
    repoOwner: "akash-network",
    repoName: "cosmos-omnibus",
    mainBranch: "master"
  },
  "akash-linuxserver": {
    repoOwner: "cryptoandcoffee",
    repoName: "akash-linuxserver",
    mainBranch: "main"
  }
};

export class TemplateFetcherService {
  readonly #logger: LoggerService;

  /**
   * Github API rate limits requests.
   * See: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28#primary-rate-limit-for-authenticated-users
   */
  #githubRequestsRemaining: string | null = null;
  readonly #octokit: Octokit;
  readonly #archiveService: GitHubArchiveService;
  readonly #options: Required<Omit<FetcherOptions, "githubPAT">>;

  constructor(
    private readonly templateProcessor: TemplateProcessorService,
    logger: LoggerService,
    createOctokit: (githubPAT?: string, fetch?: typeof globalThis.fetch) => Octokit,
    archiveService: GitHubArchiveService,
    options: FetcherOptions
  ) {
    this.#octokit = createOctokit(options.githubPAT, async (...args) => {
      const response = await fetch(...args);
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (remaining) this.#githubRequestsRemaining = remaining;
      return response;
    });
    this.#archiveService = archiveService;
    this.#logger = logger;
    this.#options = {
      categoryProcessingConcurrency: options.categoryProcessingConcurrency ?? 10,
      templateSourceProcessingConcurrency: options.templateSourceProcessingConcurrency ?? 10
    };
  }

  get githubRequestsRemaining(): string | null {
    return this.#githubRequestsRemaining;
  }

  clearArchiveCache(): void {
    this.#archiveService.clearCache();
  }

  async fetchLatestCommitSha(repository: keyof typeof REPOSITORIES) {
    const { repoOwner, repoName, mainBranch } = REPOSITORIES[repository];
    const response = await this.#octokit.rest.repos.getBranch({
      owner: repoOwner,
      repo: repoName,
      branch: mainBranch
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch latest version of ${repoOwner}/${repoName} from github`, { cause: response });
    }

    return response.data.commit.sha;
  }

  private async fetchFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    if (!ref) {
      throw new Error(`Cannot fetch file content without a ref for ${owner}/${repo}/${path}`);
    }

    const archive = await this.#archiveService.getArchive(owner, repo, ref);
    const content = await archive.readFile(path);

    if (content === null) {
      throw new Error(`File not found in archive: ${owner}/${repo}/${path}@${ref}`);
    }

    return content;
  }

  private async fetchDirectoryContent(owner: string, repo: string, path: string, ref: string): Promise<GithubDirectoryItem[]> {
    const archive = await this.#archiveService.getArchive(owner, repo, ref);
    const entries = archive.listDirectory(path);

    return entries.map(entry => ({
      type: entry.type,
      size: 0,
      name: entry.name,
      path: entry.path,
      sha: "",
      url: "",
      git_url: "",
      html_url: "",
      download_url: "",
      _links: {
        git: "",
        html: "",
        self: ""
      }
    }));
  }

  private async fetchChainRegistryData(chainPath: string): Promise<GithubChainRegistryChainResponse> {
    const archive = await this.#archiveService.getArchive("cosmos", "chain-registry", "master");
    const content = await archive.readFile(`${chainPath}/chain.json`);

    if (content === null) {
      throw new Error(`Chain registry data not found for ${chainPath}`);
    }

    return JSON.parse(content) as GithubChainRegistryChainResponse;
  }

  private async findFileContentAsync(filename: string | string[], fileList: GithubDirectoryItem[], templateSource: TemplateSource): Promise<string | null> {
    const filenames = typeof filename === "string" ? [filename] : filename;
    const fileDef = fileList.find(f => filenames.some(x => x.toLowerCase() === f.name.toLowerCase()));

    if (!fileDef) return null;

    return await this.fetchFileContent(templateSource.repoOwner, templateSource.repoName, fileDef.path, templateSource.repoVersion);
  }

  private async processTemplateSource(
    templateSource: TemplateSource,
    directoryItems: GithubDirectoryItem[],
    options: { includeConfigJson?: boolean }
  ): Promise<any> {
    try {
      if (templateSource.path.startsWith("http:") || templateSource.path.startsWith("https:")) {
        throw new Error("Absolute URL not supported");
      }

      const readme = await this.findFileContentAsync("README.md", directoryItems, templateSource);
      const [deploy, guide, configJsonText] = await Promise.all([
        this.findFileContentAsync(["deploy.yaml", "deploy.yml"], directoryItems, templateSource),
        this.findFileContentAsync("GUIDE.md", directoryItems, templateSource),
        options.includeConfigJson ? this.findFileContentAsync("config.json", directoryItems, templateSource) : Promise.resolve(null)
      ]);

      const template = this.templateProcessor.processTemplate(templateSource, readme, deploy, guide, configJsonText);
      return template;
    } catch (error) {
      this.#logger.warn({
        event: "TEMPLATE_SOURCE_PROCESSING_SKIPPED",
        templateSource: templateSource.name,
        error
      });
      return null;
    }
  }

  private async processCategory(category: Category, options: ProcessCategoryOptions): Promise<void> {
    const templates = await this.mapConcurrently(
      category.templateSources,
      async templateSource => {
        try {
          if (
            templateSource.path.startsWith("http:") ||
            templateSource.path.startsWith("https:") ||
            options.ignoreByPaths?.some(x => templateSource.path === x)
          ) {
            this.#logger.warn({
              event: "TEMPLATE_SOURCE_PROCESSING_SKIPPED",
              templateSource: templateSource.name,
              templateSourcePath: templateSource.path,
              message: "Template source ignored because it's an absolute URL or a path that matches an ignore path.",
              ignoreByPaths: options.ignoreByPaths
            });
            return null;
          }

          const directoryItems = await this.fetchDirectoryContent(
            templateSource.repoOwner,
            templateSource.repoName,
            templateSource.path,
            templateSource.repoVersion
          );

          const readme = await this.findFileContentAsync("README.md", directoryItems, templateSource);
          const readmeText = readme?.toLowerCase();

          if (options.ignoreByKeywords && readmeText && options.ignoreByKeywords.some(x => readmeText.includes(x.toLowerCase()))) {
            this.#logger.warn({
              event: "TEMPLATE_SOURCE_PROCESSING_SKIPPED",
              templateSource: templateSource.name,
              message: "Template source ignored because its README.md contains keywords to ignore.",
              keywords: options.ignoreByKeywords
            });
            return null;
          }

          return this.processTemplateSource(templateSource, directoryItems, options);
        } catch (error) {
          this.#logger.warn({
            event: "TEMPLATE_SOURCE_PROCESSING_SKIPPED",
            templateSource: templateSource.name,
            error
          });
          return null;
        }
      },
      { concurrency: this.#options.templateSourceProcessingConcurrency }
    );

    category.templates = templates.filter(x => !!x);
  }

  private async fetchTemplatesInfo(categories: Category[], options: ProcessCategoryOptions = {}): Promise<Category[]> {
    await this.mapConcurrently(categories, category => this.processCategory(category, options), { concurrency: this.#options.categoryProcessingConcurrency });

    return categories;
  }

  private async fetchTemplatesFromReadme(
    options: ProcessCategoryOptions & {
      repoOwner: string;
      repoName: string;
      repoVersion: string;
      readmePath?: string;
      templateSourceMapper?: (name: string, path: string) => TemplateSource;
    }
  ): Promise<Category[]> {
    const {
      repoOwner,
      repoName,
      repoVersion,
      readmePath = "README.md",
      includeConfigJson,
      ignoreByKeywords,
      ignoreByPaths,
      templateSourceMapper = (name, path) => ({
        name,
        path,
        repoOwner,
        repoName,
        repoVersion
      })
    } = options;

    try {
      const data = await this.fetchFileContent(repoOwner, repoName, readmePath, repoVersion);

      const categoryRegex = /### (.+)\n*([\w ]+)?\n*((?:- \[(?:.+)]\((?:.+)\)\n?)*)/gm;
      const templateRegex = /(- \[(.+)]\((.+)\)\n?)/gm;

      const categories: Category[] = [];

      const matches = data.matchAll(categoryRegex);
      for (const match of matches) {
        const title = match[1];
        const description = match[2];
        const templatesStr = match[3];

        if (categories.some(x => x.title === title) || !templatesStr) continue;

        const templateSources: TemplateSource[] = [];
        const templateMatches = templatesStr.matchAll(templateRegex);
        for (const templateMatch of templateMatches) {
          templateSources.push(templateSourceMapper(templateMatch[2], templateMatch[3]));
        }

        categories.push({
          title: title,
          description: description,
          templateSources: templateSources,
          templates: []
        });
      }

      return await this.fetchTemplatesInfo(categories, { includeConfigJson, ignoreByKeywords, ignoreByPaths });
    } catch (error) {
      this.#logger.warn({
        event: "FETCH_TEMPLATES_FROM_README_FAILED",
        repoOwner,
        repoName,
        repoVersion,
        error
      });
      return [];
    }
  }

  async fetchOmnibusTemplates(repoVersion: string): Promise<Category[]> {
    const { repoOwner, repoName } = REPOSITORIES["cosmos-omnibus"];
    const directoryItems = await this.fetchDirectoryContent(repoOwner, repoName, "", repoVersion);
    const folders = directoryItems.filter(f => f.type === "dir" && !f.name.startsWith(".") && !f.name.startsWith("_") && f.name !== "generic");

    const templateSources = folders.map<TemplateSource>(x => ({
      name: x.name,
      path: x.path,
      logoUrl: null,
      summary:
        "This is a meta package of cosmos-sdk-based docker images and configuration meant to make deploying onto Akash easy and standardized across cosmos.",
      repoName,
      repoOwner,
      repoVersion
    }));

    await this.mapConcurrently(
      templateSources,
      async templateSource => {
        try {
          const chainData = await this.fetchChainRegistryData(templateSource.path);
          templateSource.name = chainData.pretty_name;
          templateSource.summary = chainData.description ?? templateSource.summary;
          templateSource.logoUrl = Object.values(chainData.logo_URIs ?? {})[0];
        } catch (error) {
          this.#logger.warn({
            event: "CHAIN_REGISTRY_DATA_FETCH_FAILED",
            templateSource: templateSource.path,
            error
          });
        }
      },
      { concurrency: this.#options.templateSourceProcessingConcurrency }
    );

    const categories: Category[] = [
      {
        title: "Blockchain",
        templateSources: templateSources,
        templates: []
      }
    ];

    return await this.fetchTemplatesInfo(categories, { includeConfigJson: true });
  }

  async fetchAwesomeAkashTemplates(repoVersion: string): Promise<Category[]> {
    const { repoOwner, repoName } = REPOSITORIES["awesome-akash"];
    return this.fetchTemplatesFromReadme({
      repoOwner,
      repoName,
      repoVersion,
      includeConfigJson: true
    });
  }

  async fetchLinuxServerTemplates(repoVersion: string): Promise<Category[]> {
    const { repoOwner, repoName } = REPOSITORIES["akash-linuxserver"];
    return this.fetchTemplatesFromReadme({
      repoOwner,
      repoName,
      repoVersion,
      ignoreByKeywords: [
        "not recommended for use by the general public",
        "THIS IMAGE IS DEPRECATED",
        "container is not meant for public consumption",
        "Not for public consumption"
      ],
      ignoreByPaths: [
        // these templates are listed but don't exist in the repository
        "jenkins",
        "mongodb",
        "rtorrent"
      ]
    });
  }

  private async mapConcurrently<T, U>(array: T[], callback: (item: T, index: number) => Promise<U>, options: { concurrency: number }): Promise<U[]> {
    const { results, errors } = await PromisePool.withConcurrency(options.concurrency)
      .for(array)
      .useCorrespondingResults()
      .process(async (item, index) => callback(item, index));

    if (errors.length > 0) {
      throw new Error(errors.map(e => e.message).join("\n"));
    }

    return results.filter((value): value is U => typeof value !== "symbol");
  }
}

interface FetcherOptions {
  githubPAT: string;
  categoryProcessingConcurrency?: number;
  templateSourceProcessingConcurrency?: number;
}

interface ProcessCategoryOptions {
  includeConfigJson?: boolean;
  ignoreByKeywords?: string[];
  ignoreByPaths?: string[];
}
