import type { Octokit } from "@octokit/rest";
import { PromisePool } from "@supercharge/promise-pool";
import * as fs from "fs";
import { markdownToTxt } from "markdown-to-txt";
import path from "path";

import type { GithubChainRegistryChainResponse } from "@src/types";
import type { GithubDirectoryItem } from "@src/types/github";
import { getLogoFromPath } from "@src/utils/templateReposLogos";
import { isUrlAbsolute } from "@src/utils/urls";
import { getOctokit } from "./githubService";

const generatingTasks: Record<string, Promise<Category[]> | null> = {};
let lastServedData: FinalCategory[] | null = null;
let githubRequestsRemaining: string | null | undefined = null;

const MAP_CONCURRENTLY_OPTIONS: MapConcurrentlyOptions = {
  concurrency: 30
};

type Category = {
  title: string;
  description?: string;
  templateSources: TemplateSource[];
  templates: Template[];
};

export type FinalCategory = Omit<Category, "templateSources">;

export type Template = {
  id?: string;
  name: string;
  path: string;
  readme?: string;
  summary: string;
  logoUrl: string;
  deploy?: string;
  guide?: string;
  githubUrl?: string;
  persistentStorageEnabled?: boolean;
  config?: { ssh?: boolean; logoUrl?: string };
};

type TemplateSource = {
  name: string;
  path: string;
  repoOwner: string;
  repoName: string;
  repoVersion: string;
  summary?: string;
  logoUrl?: string | null;
};

async function getTemplatesFromRepo(
  octokit: Octokit,
  repoOwner: string,
  repoName: string,
  fetchTemplates: (ocktokit: Octokit, version: string) => Promise<Category[]>,
  dataFolderPath: string
) {
  const repoVersion = await fetchLatestCommitSha(octokit, repoOwner, repoName);
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
    generatingTasks[cacheFilePath] = fetchTemplates(octokit, repoVersion);
    const categories = await generatingTasks[cacheFilePath];
    generatingTasks[cacheFilePath] = null;

    await fs.promises.mkdir(path.dirname(cacheFilePath), { recursive: true });
    await fs.promises.writeFile(cacheFilePath, JSON.stringify(categories, null, 2));

    return categories;
  }
}

function mergeTemplateCategories(...categories: Category[]) {
  const mergedCategories: Category[] = [];
  for (const category of categories.flat()) {
    const existingCategory = mergedCategories.find(c => c.title.toLowerCase() === category.title.toLowerCase());
    if (existingCategory) {
      existingCategory.templates = (existingCategory.templates || []).concat(category.templates);
    } else {
      mergedCategories.push(JSON.parse(JSON.stringify(category)));
    }
  }

  return mergedCategories;
}

export const getTemplateGallery = async (input: GetTemplateGalleryInput) => {
  try {
    const octokit = getOctokit(input.githubPAT);

    const [awesomeAkashTemplates, omnibusTemplates, linuxServerTemplates] = await Promise.all([
      getTemplatesFromRepo(octokit, "akash-network", "awesome-akash", fetchAwesomeAkashTemplates, input.dataFolderPath),
      getTemplatesFromRepo(octokit, "akash-network", "cosmos-omnibus", fetchOmnibusTemplates, input.dataFolderPath),
      getTemplatesFromRepo(octokit, "cryptoandcoffee", "akash-linuxserver", fetchLinuxServerTemplates, input.dataFolderPath)
    ]);

    const templateGallery = mergeTemplateCategories(omnibusTemplates, awesomeAkashTemplates, linuxServerTemplates).map(
      ({ templateSources, ...category }) => category
    );

    lastServedData = templateGallery;

    console.log(`${githubRequestsRemaining} requests remaining`);

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
};

interface GetTemplateGalleryInput {
  githubPAT: string;
  dataFolderPath: string;
}

export const fetchLatestCommitSha = async (octokit: Octokit, owner: string, repo: string): Promise<string> => {
  const response = await octokit.rest.repos.getBranch({
    owner: owner,
    repo: repo,
    branch: "master"
  });

  githubRequestsRemaining = response.headers["x-ratelimit-remaining"];

  if (response.status !== 200) {
    throw new Error(`Failed to fetch latest version of ${owner}/${repo} from github`);
  }

  return response.data.commit.sha;
};

// Fetch templates from the cosmos-omnibus repo
async function fetchOmnibusTemplates(octokit: Octokit, repoVersion: string) {
  const response = await octokit.rest.repos.getContent({
    owner: "akash-network",
    repo: "cosmos-omnibus",
    ref: repoVersion,
    path: "",
    mediaType: {
      format: "raw"
    }
  });

  githubRequestsRemaining = response.headers["x-ratelimit-remaining"];

  if (!Array.isArray(response.data)) throw "Could not fetch list of files from akash-network/cosmos-omnibus";

  const folders = response.data.filter(f => f.type === "dir" && !f.name.startsWith(".") && !f.name.startsWith("_"));
  const templateSources = folders.map<TemplateSource>(x => ({
    name: x.name,
    path: x.path,
    logoUrl: null,
    summary:
      "This is a meta package of cosmos-sdk-based docker images and configuration meant to make deploying onto Akash easy and standardized across cosmos.",
    repoName: "cosmos-omnibus",
    repoOwner: "akash-network",
    repoVersion: repoVersion
  }));

  await mapConcurrently(
    templateSources,
    async templateSource => {
      try {
        const chainResponse = await fetch(`https://raw.githubusercontent.com/cosmos/chain-registry/master/${templateSource.path}/chain.json`);

        if (chainResponse.status !== 200) throw "Could not fetch chain.json for " + templateSource.path;

        const chainData = (await chainResponse.json()) as GithubChainRegistryChainResponse;
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

  return await fetchTemplatesInfo(octokit, categories);
}

// Fetch templates from the Awesome-Akash repo
async function fetchAwesomeAkashTemplates(octokit: Octokit, repoVersion: string) {
  // Fetch list of templates from README.md
  const response = await octokit.rest.repos.getContent({
    owner: "akash-network",
    repo: "awesome-akash",
    path: "README.md",
    ref: repoVersion,
    mediaType: {
      format: "raw"
    }
  });

  githubRequestsRemaining = response.headers["x-ratelimit-remaining"];

  if (response.status !== 200) throw Error("Invalid response code: " + response.status);

  const data = String(response.data);

  const categoryRegex = /### (.+)\n*([\w ]+)?\n*((?:- \[(?:.+)]\((?:.+)\)\n?)*)/gm;
  const templateRegex = /(- \[(.+)]\((.+)\)\n?)/gm;

  const categories: Category[] = [];

  // Looping through categories
  const matches = data.matchAll(categoryRegex);
  for (const match of matches) {
    const title = match[1];
    const description = match[2];
    const templatesStr = match[3];

    // Ignore duplicate categories
    if (categories.some(x => x.title === title)) {
      continue;
    }

    if (!templatesStr) continue;

    // Extracting templates
    const templateSources: TemplateSource[] = [];
    const templateMatches = templatesStr.matchAll(templateRegex);
    for (const templateMatch of templateMatches) {
      templateSources.push({
        name: templateMatch[2],
        path: templateMatch[3],
        repoOwner: "akash-network",
        repoName: "awesome-akash",
        repoVersion: repoVersion
      });
    }

    categories.push({
      title: title,
      description: description,
      templateSources: templateSources,
      templates: []
    });
  }

  return await fetchTemplatesInfo(octokit, categories);
}

// Fetch templates from the akash-linuxserver repo
async function fetchLinuxServerTemplates(octokit: Octokit, repoVersion: string) {
  // Fetch list of templates from README.md
  const response = await octokit.rest.repos.getContent({
    owner: "cryptoandcoffee",
    repo: "akash-linuxserver",
    path: "README.md",
    ref: repoVersion,
    mediaType: {
      format: "raw"
    }
  });

  githubRequestsRemaining = response.headers["x-ratelimit-remaining"];

  if (response.status !== 200) throw Error("Invalid response code: " + response.status);

  const data = String(response.data);

  const categoryRegex = /### (.+)\n*([\w ]+)?\n*((?:- \[(?:.+)]\((?:.+)\)\n?)*)/gm;
  const templateRegex = /(- \[(.+)]\((.+)\)\n?)/gm;

  const categories: Category[] = [];

  // Looping through categories
  const matches = data.matchAll(categoryRegex);
  for (const match of matches) {
    const title = match[1];
    const description = match[2];
    const templatesStr = match[3];

    // Ignore duplicate categories
    if (categories.some(x => x.title === title)) {
      continue;
    }

    if (!templatesStr) continue;

    // Extracting templates
    const templatesSources: TemplateSource[] = [];
    const templateMatches = templatesStr.matchAll(templateRegex);
    for (const templateMatch of templateMatches) {
      templatesSources.push({
        name: templateMatch[2],
        path: templateMatch[3],
        repoOwner: "cryptoandcoffee",
        repoName: "akash-linuxserver",
        repoVersion: repoVersion
      });
    }

    categories.push({
      title: title,
      description: description,
      templateSources: templatesSources,
      templates: []
    });
  }

  return await fetchLinuxServerTemplatesInfo(octokit, categories);
}

export async function fetchLinuxServerTemplatesInfo(octokit: Octokit, categories: Category[]) {
  await mapConcurrently(
    categories,
    async category => {
      const templates = await mapConcurrently(
        category.templateSources,
        async templateSource => {
          try {
            // Ignoring templates that are not in the awesome-akash repo
            if (templateSource.path.startsWith("http:") || templateSource.path.startsWith("https:")) {
              throw "Absolute URL";
            }

            // Fetching file list in template folder
            const response = await octokit.rest.repos.getContent({
              repo: templateSource.repoName,
              owner: templateSource.repoOwner,
              ref: templateSource.repoVersion,
              path: templateSource.path,
              mediaType: {
                format: "raw"
              }
            });

            if (!Array.isArray(response.data)) throw "Response data is not an array";
            const directoryItems = response.data as GithubDirectoryItem[];

            githubRequestsRemaining = response.headers["x-ratelimit-remaining"];

            const readme = await findFileContentAsync("README.md", directoryItems);

            // Skip deprecated and wip images
            const ignoreList = [
              "not recommended for use by the general public",
              "THIS IMAGE IS DEPRECATED",
              "container is not meant for public consumption",
              "Not for public consumption"
            ];

            if (ignoreList.map(x => x.toLowerCase()).some(x => readme?.toLowerCase().includes(x))) {
              return;
            }

            const [deploy, guide] = await Promise.all([
              findFileContentAsync(["deploy.yaml", "deploy.yml"], directoryItems),
              findFileContentAsync("GUIDE.md", directoryItems)
            ]);

            if (!readme || !deploy) return;

            const template: Template = {
              name: templateSource.name,
              path: templateSource.path,
              logoUrl: templateSource.logoUrl || "",
              summary: templateSource.summary || ""
            };

            template.readme = removeComments(
              replaceLinks(readme, templateSource.repoOwner, templateSource.repoName, templateSource.repoVersion, template.path)
            );

            if (template.readme.startsWith("undefined")) {
              template.readme = template.readme.substring("undefined".length);
            }

            template.deploy = deploy;
            template.persistentStorageEnabled = !!deploy && (deploy.includes("persistent: true") || deploy.includes("persistent:true"));
            template.guide = guide || undefined;
            template.githubUrl = `https://github.com/${templateSource.repoOwner}/${templateSource.repoName}/blob/${templateSource.repoVersion}/${templateSource.path}`;

            if (!template.logoUrl) {
              template.logoUrl = getLogoFromPath(template.path) || "";
            }

            if (!template.summary) {
              template.summary = getLinuxServerTemplateSummary(readme) || "";
            }

            template.id = `${templateSource.repoOwner}-${templateSource.repoName}-${templateSource.path}`;
            template.path = template.id; // For compatibility with old deploy tool versions (TODO: remove in future)

            console.log(category.title + " - " + template.name);
            return template;
          } catch (err: any) {
            console.warn(`Skipped ${templateSource.name} because of error: ${err.message || err}`);
          }
        },
        MAP_CONCURRENTLY_OPTIONS
      );
      category.templates = templates.filter(x => !!x);
    },
    MAP_CONCURRENTLY_OPTIONS
  );

  //console.log("Requests remaining: " + reqRemaining);

  return categories;
}

export async function fetchTemplatesInfo(octokit: Octokit, categories: Category[]) {
  await mapConcurrently(
    categories,
    async category => {
      const templates = await mapConcurrently(
        category.templateSources,
        async templateSource => {
          try {
            // Ignoring templates that are not in the awesome-akash repo
            if (templateSource.path.startsWith("http:") || templateSource.path.startsWith("https:")) {
              throw "Absolute URL";
            }

            // Fetching file list in template folder
            const response = await octokit.rest.repos.getContent({
              repo: templateSource.repoName,
              owner: templateSource.repoOwner,
              ref: templateSource.repoVersion,
              path: templateSource.path,
              mediaType: {
                format: "raw"
              }
            });

            if (!Array.isArray(response.data)) throw "Response data is not an array";
            const directoryItems = response.data as GithubDirectoryItem[];

            githubRequestsRemaining = response.headers["x-ratelimit-remaining"];

            const [readme, deploy, guide, configJsonText] = await Promise.all([
              findFileContentAsync("README.md", directoryItems),
              findFileContentAsync(["deploy.yaml", "deploy.yml"], directoryItems),
              findFileContentAsync("GUIDE.md", directoryItems),
              findFileContentAsync("config.json", directoryItems)
            ]);
            // Remove templates without "README.md" and "deploy.yml"
            if (!readme || !deploy) return;

            const config = configJsonText ? JSON.parse(configJsonText) : { ssh: false, logoUrl: "" };

            const template: Template = {
              name: templateSource.name,
              path: templateSource.path,
              logoUrl: templateSource.logoUrl || "",
              summary: templateSource.summary || "",
              config
            };

            template.readme =
              readme && replaceLinks(readme, templateSource.repoOwner, templateSource.repoName, templateSource.repoVersion, templateSource.path);
            template.deploy = deploy;
            template.persistentStorageEnabled = !!deploy && (deploy.includes("persistent: true") || deploy.includes("persistent:true"));
            template.guide = guide || undefined;
            template.githubUrl = `https://github.com/${templateSource.repoOwner}/${templateSource.repoName}/blob/${templateSource.repoVersion}/${templateSource.path}`;

            if (!template.logoUrl) {
              const logoFromPath = getLogoFromPath(template.path);
              const configLogo = config.logoUrl || "";
              template.logoUrl = logoFromPath || configLogo;
            }

            if (!template.summary) {
              template.summary = getTemplateSummary(readme) || "";
            }

            template.id = `${templateSource.repoOwner}-${templateSource.repoName}-${templateSource.path}`;
            template.path = template.id; // For compatibility with old deploy tool versions (TODO: remove in future)

            console.log(category.title + " - " + template.name);
            return template;
          } catch (err: any) {
            console.warn(`Skipped ${templateSource.name} because of error: ${err.message || err}`);
          }
        },
        MAP_CONCURRENTLY_OPTIONS
      );
      category.templates = templates.filter(x => !!x);
    },
    MAP_CONCURRENTLY_OPTIONS
  );

  //console.log("Requests remaining: " + reqRemaining);

  return categories;
}

// Find a github file by name and download it
async function findFileContentAsync(filename: string | string[], fileList: GithubDirectoryItem[]) {
  const filenames = typeof filename === "string" ? [filename] : filename;
  const fileDef = fileList.find(f => filenames.some(x => x.toLowerCase() === f.name.toLowerCase()));

  if (!fileDef) return null;

  const response = await fetch(fileDef.download_url);
  const content = await response.text();

  return content;
}

// Create a short summary from the README.md
function getTemplateSummary(readme: string) {
  if (!readme) return null;

  const markdown = readme
    .replace(/!\[.*\]\(.+\)\n*/g, "") // Remove images
    .replace(/^#+ .*\n+/g, ""); // Remove first header

  const readmeTxt = markdownToTxt(markdown).trim();
  const maxLength = 200;
  const summary = readmeTxt.length > maxLength ? readmeTxt.substring(0, maxLength - 3).trim() + "..." : readmeTxt;

  return summary;
}

// Create a short summary from the README.md
function getLinuxServerTemplateSummary(readme: string) {
  if (!readme) return null;

  let markdown = readme;
  const titleMatch = /# \[linuxserver\/[\w-]+\]\(.+\)/.exec(markdown);
  if (titleMatch) {
    markdown = markdown.substring(titleMatch.index + titleMatch[0].length); // Remove LinuxServer header
  }

  const badgesMatch = /(\[!\[.+\]\(.*\)]\(.*\)\n)+/.exec(markdown);
  if (badgesMatch) {
    markdown = markdown.substring(badgesMatch.index + badgesMatch[0].length);
  }

  const readmeTxt = markdownToTxt(markdown).trim();
  const maxLength = 200;
  const summary = readmeTxt.length > maxLength ? readmeTxt.substring(0, maxLength - 3).trim() + "..." : readmeTxt;

  return summary;
}

// Replaces local links with absolute links
function replaceLinks(markdown: string, owner: string, repo: string, version: string, folder: string) {
  let newMarkdown = markdown;
  const linkRegex = /!?\[([^[]*)\]\((.*?)\)/gm;
  const matches = newMarkdown.matchAll(linkRegex);
  for (const match of matches) {
    const originalUrl = match[2];
    const url = originalUrl.replace(/^\.?\//, "");

    if (isUrlAbsolute(url)) continue;

    const isPicture = match[0].startsWith("!");
    const absoluteUrl = isPicture
      ? `https://raw.githubusercontent.com/${owner}/${repo}/${version}/${folder}/` + url
      : `https://github.com/${owner}/${repo}/blob/${version}/${folder}/` + url;

    newMarkdown = newMarkdown.split("(" + originalUrl + ")").join("(" + absoluteUrl + ")");
  }

  return newMarkdown;
}

// Remove markdown comments
function removeComments(markdown: string) {
  return markdown.replace(/<!--.+-->/g, "");
}

async function mapConcurrently<T, U>(array: T[], callback: (item: T, index: number) => Promise<U>, options: MapConcurrentlyOptions) {
  const { results, errors } = await PromisePool.withConcurrency(options.concurrency)
    .for(array)
    .useCorrespondingResults()
    .process(async (item, index) => callback(item, index));

  if (errors.length > 0) {
    throw new Error(errors.map(e => e.message).join("\n"));
  }

  return results.filter((value): value is U => typeof value !== "symbol");
}

interface MapConcurrentlyOptions {
  concurrency: number;
}
