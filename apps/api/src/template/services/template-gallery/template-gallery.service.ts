import { minutesToSeconds } from "date-fns";
import * as fs from "fs";
import path from "path";
import { injectable } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import type { Category, FinalCategory, Template } from "@src/template/types/template";
import { dataFolderPath } from "@src/utils/constants";
import { REPOSITORIES, TemplateFetcherService } from "../template-fetcher/template-fetcher.service";
import { TemplateProcessorService } from "../template-processor/template-processor.service";

const generatingTasks: Record<string, Promise<Category[]> | null> = {};
let lastServedData: FinalCategory[] | null = null;

@injectable()
export class TemplateGalleryService {
  constructor(
    private readonly templateFetcher: TemplateFetcherService,
    private readonly templateProcessor: TemplateProcessorService
  ) {}

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

      lastServedData = templateGallery;

      console.log(`${this.templateFetcher.getGithubRequestsRemaining()} requests remaining`);

      return templateGallery;
    } catch (err) {
      if (lastServedData) {
        console.error(err);
        console.log("Serving template gallery from last working version");
        return lastServedData;
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
    const { repoName, repoOwner, repoVersion } = await this.templateFetcher.fetchLatestCommitSha(repository);
    const cacheFilePath = `${dataFolderPath}/templates/${repoOwner}-${repoName}-${repoVersion}.json`;
    const cacheFileExists = await fs.promises.access(cacheFilePath, fs.constants.R_OK).then(
      () => true,
      () => false
    );

    if (cacheFileExists) {
      console.log("Returning cached templates from", cacheFilePath);
      const fileContent = await fs.promises.readFile(cacheFilePath, "utf8");
      return JSON.parse(fileContent);
    } else if (generatingTasks[cacheFilePath]) {
      console.log("Waiting on existing task for", repoOwner, repoName);
      return await generatingTasks[cacheFilePath];
    } else {
      console.log("No cache found for", repoOwner, repoName, "generating...");
      generatingTasks[cacheFilePath] = fetchTemplates(repoVersion);
      const categories = await generatingTasks[cacheFilePath];
      generatingTasks[cacheFilePath] = null;

      await fs.promises.mkdir(path.dirname(cacheFilePath), { recursive: true });
      await fs.promises.writeFile(cacheFilePath, JSON.stringify(categories, null, 2));

      return categories;
    }
  }
}
