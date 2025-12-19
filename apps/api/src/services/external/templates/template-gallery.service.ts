import { minutesToSeconds } from "date-fns";
import * as fs from "fs";
import path from "path";

import { Memoize } from "@src/caching/helpers";
import type { Category, FinalCategory, Template } from "@src/template/types/template";
import { REPOSITORIES, TemplateFetcherService } from "./template-fetcher.service";
import { TemplateProcessorService } from "./template-processor.service";

type Options = {
  githubPAT?: string;
  dataFolderPath: string;
};

export class TemplateGalleryService {
  private generatingTasks: Record<string, Promise<Category[]> | null> = {};
  private lastServedData: FinalCategory[] | null = null;

  private readonly templateFetcher: TemplateFetcherService;
  private readonly templateProcessor: TemplateProcessorService;

  constructor(private readonly options: Options) {
    this.templateProcessor = new TemplateProcessorService();
    this.templateFetcher = new TemplateFetcherService(this.templateProcessor, this.options.githubPAT);
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getTemplateGallery() {
    try {
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

      const templateGallery = this.templateProcessor
        .mergeTemplateCategories(omnibusTemplates, awesomeAkashTemplates, linuxServerTemplates)
        .map(({ templateSources, ...category }) => category);

      this.lastServedData = templateGallery;

      console.log(`${this.templateFetcher.githubRequestsRemaining} requests remaining`);

      return templateGallery;
    } catch (err) {
      if (this.lastServedData) {
        console.error(err);
        console.log("Serving template gallery from last working version");
        return this.lastServedData;
      } else {
        throw err;
      }
    }
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getTemplateById(id: Required<Template>["id"]): Promise<Template | null> {
    const templatesByCategory = await this.getTemplateGallery();
    for (const category of templatesByCategory) {
      const template = category.templates.find(template => template.id === id);
      if (template) {
        return template;
      }
    }

    return null;
  }

  private async getTemplatesFromRepo({
    repository,
    fetchTemplates
  }: {
    repository: keyof typeof REPOSITORIES;
    fetchTemplates: (version: string) => Promise<Category[]>;
  }): Promise<Category[]> {
    const { repoName, repoOwner } = REPOSITORIES[repository];
    const cachePathPrefix = `${this.options.dataFolderPath}/templates/${repoOwner}-${repoName}`;
    const latestCommitSha = await this.templateFetcher.fetchLatestCommitSha(repository).catch(async error => {
      const files = await Array.fromAsync(fs.promises.glob(`${cachePathPrefix}-*.json`));
      if (!files.length) throw error;

      return files[0].slice(path.normalize(cachePathPrefix).length + 1, -1 * ".json".length);
    });
    const cacheFilePath = `${cachePathPrefix}-${latestCommitSha}.json`;
    const cacheFileExists = await fs.promises.access(cacheFilePath, fs.constants.R_OK).then(
      () => true,
      () => false
    );

    if (cacheFileExists) {
      console.log("Returning cached templates from", cacheFilePath);
      const fileContent = await fs.promises.readFile(cacheFilePath, "utf8");
      return JSON.parse(fileContent);
    } else if (this.generatingTasks[cacheFilePath]) {
      console.log("Waiting on existing task for", repoOwner, repoName);
      return await this.generatingTasks[cacheFilePath];
    } else {
      console.log("No cache found for", repoOwner, repoName, "generating...");
      this.generatingTasks[cacheFilePath] = fetchTemplates(latestCommitSha);
      const categories = await this.generatingTasks[cacheFilePath];
      this.generatingTasks[cacheFilePath] = null;

      await fs.promises.mkdir(path.dirname(cacheFilePath), { recursive: true });
      await fs.promises.writeFile(cacheFilePath, JSON.stringify(categories, null, 2));

      return categories;
    }
  }
}
