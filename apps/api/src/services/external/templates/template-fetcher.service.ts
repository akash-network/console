import type { Octokit } from "@octokit/rest";
import PromisePool from "@supercharge/promise-pool";

import { getOctokit } from "@src/services/external/githubService";
import type { Category, TemplateSource } from "@src/template/types/template";
import type { GithubChainRegistryChainResponse } from "@src/types";
import type { GithubDirectoryItem } from "@src/types/github";
import type { TemplateProcessorService } from "./template-processor.service";

const MAP_CONCURRENTLY_OPTIONS = {
  concurrency: 30
};

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
  private _githubRequestsRemaining: string | null = null;
  private _octokit: Octokit | undefined = undefined;

  constructor(
    private readonly templateProcessor: TemplateProcessorService,
    githubPAT?: string
  ) {
    if (!githubPAT) throw new Error("Cannot fetch templates without GitHub PAT");

    this._octokit = getOctokit(githubPAT);
  }

  get githubRequestsRemaining(): string | null {
    return this._githubRequestsRemaining;
  }

  private setGithubRequestsRemaining(value?: string) {
    if (value) {
      this._githubRequestsRemaining = value;
    }
  }

  private get octokit(): Octokit {
    if (!this._octokit) {
      throw new Error("Octokit client is not initialized");
    }

    return this._octokit;
  }

  async fetchLatestCommitSha(repository: keyof typeof REPOSITORIES) {
    const { repoOwner, repoName, mainBranch } = REPOSITORIES[repository];
    const response = await this.octokit.rest.repos.getBranch({
      owner: repoOwner,
      repo: repoName,
      branch: mainBranch
    });

    this.setGithubRequestsRemaining(response.headers["x-ratelimit-remaining"]);

    if (response.status !== 200) {
      throw new Error(`Failed to fetch latest version of ${repoOwner}/${repoName} from github`);
    }

    return {
      repoOwner,
      repoName,
      repoVersion: response.data.commit.sha
    };
  }

  private async fetchFileContent(owner: string, repo: string, path: string, ref: string): Promise<string> {
    const response = await this.octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
      mediaType: {
        format: "raw"
      }
    });

    this.setGithubRequestsRemaining(response.headers["x-ratelimit-remaining"]);

    if (response.status !== 200) {
      throw new Error(`Failed to fetch content from ${owner}/${repo}/${path}`);
    }

    return String(response.data);
  }

  private async fetchDirectoryContent(owner: string, repo: string, path: string, ref: string): Promise<GithubDirectoryItem[]> {
    const response = await this.octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
      mediaType: {
        format: "raw"
      }
    });

    this.setGithubRequestsRemaining(response.headers["x-ratelimit-remaining"]);

    if (!Array.isArray(response.data)) {
      throw new Error(`Failed to fetch directory content from ${owner}/${repo}/${path}`);
    }

    return response.data as GithubDirectoryItem[];
  }

  private async fetchChainRegistryData(chainPath: string): Promise<GithubChainRegistryChainResponse> {
    const response = await fetch(`https://raw.githubusercontent.com/cosmos/chain-registry/master/${chainPath}/chain.json`);

    if (response.status !== 200) {
      throw new Error(`Could not fetch chain.json for ${chainPath}`);
    }

    return (await response.json()) as GithubChainRegistryChainResponse;
  }

  private async findFileContentAsync(filename: string | string[], fileList: GithubDirectoryItem[]): Promise<string | null> {
    const filenames = typeof filename === "string" ? [filename] : filename;
    const fileDef = fileList.find(f => filenames.some(x => x.toLowerCase() === f.name.toLowerCase()));

    if (!fileDef) return null;

    const response = await fetch(fileDef.download_url);
    return response.text();
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

      const readme = await this.findFileContentAsync("README.md", directoryItems);
      const [deploy, guide, configJsonText] = await Promise.all([
        this.findFileContentAsync(["deploy.yaml", "deploy.yml"], directoryItems),
        this.findFileContentAsync("GUIDE.md", directoryItems),
        options.includeConfigJson ? this.findFileContentAsync("config.json", directoryItems) : Promise.resolve(null)
      ]);

      const template = this.templateProcessor.processTemplate(templateSource, readme, deploy, guide, configJsonText);
      if (template) {
        console.log(templateSource.name);
      }
      return template;
    } catch (err: any) {
      console.warn(`Skipped ${templateSource.name} because of error: ${err.message || err}`);
      return null;
    }
  }

  private async processCategory(category: Category, options: { includeConfigJson?: boolean; ignoreList?: string[] }): Promise<void> {
    const templates = await this.mapConcurrently(
      category.templateSources,
      async templateSource => {
        try {
          const directoryItems = await this.fetchDirectoryContent(
            templateSource.repoOwner,
            templateSource.repoName,
            templateSource.path,
            templateSource.repoVersion
          );

          const readme = await this.findFileContentAsync("README.md", directoryItems);

          if (options.ignoreList && readme) {
            if (options.ignoreList.map(x => x.toLowerCase()).some(x => readme.toLowerCase().includes(x))) {
              return null;
            }
          }

          return this.processTemplateSource(templateSource, directoryItems, options);
        } catch (err: any) {
          console.warn(`Skipped ${templateSource.name} because of error: ${err.message || err}`);
          return null;
        }
      },
      MAP_CONCURRENTLY_OPTIONS
    );

    category.templates = templates.filter(x => !!x);
  }

  private async fetchTemplatesInfo(categories: Category[], options: { includeConfigJson?: boolean; ignoreList?: string[] } = {}): Promise<Category[]> {
    await this.mapConcurrently(categories, category => this.processCategory(category, options), MAP_CONCURRENTLY_OPTIONS);

    return categories;
  }

  private async fetchTemplatesFromReadme(options: {
    repoOwner: string;
    repoName: string;
    repoVersion: string;
    readmePath?: string;
    includeConfigJson?: boolean;
    ignoreList?: string[];
    templateSourceMapper?: (name: string, path: string) => TemplateSource;
  }): Promise<Category[]> {
    const {
      repoOwner,
      repoName,
      repoVersion,
      readmePath = "README.md",
      includeConfigJson,
      ignoreList,
      templateSourceMapper = (name, path) => ({
        name,
        path,
        repoOwner,
        repoName,
        repoVersion
      })
    } = options;

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

    return await this.fetchTemplatesInfo(categories, { includeConfigJson, ignoreList });
  }

  async fetchOmnibusTemplates(repoVersion: string): Promise<Category[]> {
    const { repoOwner, repoName } = REPOSITORIES["cosmos-omnibus"];
    const directoryItems = await this.fetchDirectoryContent(repoOwner, repoName, "", repoVersion);
    const folders = directoryItems.filter(f => f.type === "dir" && !f.name.startsWith(".") && !f.name.startsWith("_"));

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
        } catch (err) {
          console.log("Could not fetch chain for", templateSource.path);
          console.error(err);
        }
      },
      { concurrency: 5 }
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
      ignoreList: [
        "not recommended for use by the general public",
        "THIS IMAGE IS DEPRECATED",
        "container is not meant for public consumption",
        "Not for public consumption"
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
