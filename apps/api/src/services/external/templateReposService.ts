import { Octokit } from "@octokit/rest";
import * as fs from "fs";
import { markdownToTxt } from "markdown-to-txt";
import fetch from "node-fetch";
import path from "path";

import { GithubChainRegistryChainResponse } from "@src/types";
import { GithubDirectoryItem } from "@src/types/github";
import { dataFolderPath } from "@src/utils/constants";
import { getLogoFromPath } from "@src/utils/templateReposLogos";
import { isUrlAbsolute } from "@src/utils/urls";
import { getOctokit } from "./githubService";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";

const generatingTasks: { [key: string]: Promise<Category[]> } = {};
let lastServedData: FinalCategory[] | null = null;
let githubRequestsRemaining: string | null = null;

if (!fs.existsSync(dataFolderPath)) {
  fs.mkdirSync(dataFolderPath);
}

type Category = {
  title: string;
  description?: string;
  templateSources: TemplateSource[];
  templates: Template[];
};

type FinalCategory = Omit<Category, "templateSources">;

type Template = {
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
  logoUrl?: string;
};

async function getTemplatesFromRepo(
  octokit: Octokit,
  repoOwner: string,
  repoName: string,
  fetcher: (ocktokit: Octokit, version: string) => Promise<Category[]>
) {
  const repoVersion = await fetchRepoVersion(octokit, repoOwner, repoName);
  const cacheFilePath = `${dataFolderPath}/templates/${repoOwner}-${repoName}-${repoVersion}.json`;

  if (fs.existsSync(cacheFilePath)) {
    console.log("Serving cached templates from", cacheFilePath);
    const fileContent = fs.readFileSync(cacheFilePath, "utf8");
    return JSON.parse(fileContent);
  } else if (generatingTasks[cacheFilePath]) {
    console.log("Waiting on existing task for", repoOwner, repoName);
    return await generatingTasks[cacheFilePath];
  } else {
    console.log("No cache found for", repoOwner, repoName, "generating...");
    generatingTasks[cacheFilePath] = fetcher(octokit, repoVersion);
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

export const getTemplateGallery = async () => {
  try {
    const octokit = getOctokit();

    const awesomeAkashTemplatesTask = getTemplatesFromRepo(octokit, "akash-network", "awesome-akash", fetchAwesomeAkashTemplates);
    const omnibusTemplatesTask = getTemplatesFromRepo(octokit, "akash-network", "cosmos-omnibus", fetchOmnibusTemplates);
    const linuxServerTemplatesTask = getTemplatesFromRepo(octokit, "cryptoandcoffee", "akash-linuxserver", fetchLinuxServerTemplates);

    const [awesomeAkashTemplates, omnibusTemplates, linuxServerTemplates] = await Promise.all([
      awesomeAkashTemplatesTask,
      omnibusTemplatesTask,
      linuxServerTemplatesTask
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

export const getCachedTemplatesGallery = (): Promise<FinalCategory[]> => cacheResponse(60 * 5, cacheKeys.getTemplates, () => getTemplateGallery(), true);

export const getTemplateById = async (id: Required<Template>['id']): Promise<Template | null> => {
    const templatesByCategory = await getCachedTemplatesGallery();
    for (const category of templatesByCategory) {
      const template = category.templates.find(template => template.id === id);
      if (template) return template;
    }

    return null;
};

export const getCachedTemplateById = (id: Required<Template>['id']) => cacheResponse(60 * 5, `${cacheKeys.getTemplates}.${id}`, () => getTemplateById(id), true);

// Fetch latest version of a repo
export const fetchRepoVersion = async (octokit: Octokit, owner: string, repo: string) => {
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
    path: null,
    mediaType: {
      format: "raw"
    }
  });

  githubRequestsRemaining = response.headers["x-ratelimit-remaining"];

  if (!Array.isArray(response.data)) throw "Could not fetch list of files from akash-network/cosmos-omnibus";

  const folders = response.data.filter(f => f.type === "dir" && !f.name.startsWith(".") && !f.name.startsWith("_"));
  const templateSources: TemplateSource[] = folders.map(x => ({
    name: x.name,
    path: x.path,
    logoUrl: null,
    summary:
      "This is a meta package of cosmos-sdk-based docker images and configuration meant to make deploying onto Akash easy and standardized across cosmos.",
    repoName: "cosmos-omnibus",
    repoOwner: "akash-network",
    repoVersion: repoVersion
  }));

  for (const templateSource of templateSources) {
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
  }

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

    // Extracting templates
    const templateSources: TemplateSource[] = [];
    if (templatesStr) {
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

    // Extracting templates
    const templatesSources: TemplateSource[] = [];
    if (templatesStr) {
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
  for (const category of categories) {
    for (const templateSource of category.templateSources) {
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

        githubRequestsRemaining = response.headers["x-ratelimit-remaining"];

        const readme = await findFileContentAsync("README.md", response.data);

        // Skip deprecated and wip images
        const ignoreList = [
          "not recommended for use by the general public",
          "THIS IMAGE IS DEPRECATED",
          "container is not meant for public consumption",
          "Not for public consumption"
        ];

        if (ignoreList.map(x => x.toLowerCase()).some(x => readme.toLowerCase().includes(x))) {
          continue;
        }

        const deploy = await findFileContentAsync(["deploy.yaml", "deploy.yml"], response.data);
        const guide = await findFileContentAsync("GUIDE.md", response.data);

        const template: Template = {
          name: templateSource.name,
          path: templateSource.path,
          logoUrl: templateSource.logoUrl,
          summary: templateSource.summary
        };

        template.readme = removeComments(replaceLinks(readme, templateSource.repoOwner, templateSource.repoName, templateSource.repoVersion, template.path));

        if (template.readme.startsWith("undefined")) {
          template.readme = template.readme.substring("undefined".length);
        }

        template.deploy = deploy;
        template.persistentStorageEnabled = deploy && (deploy.includes("persistent: true") || deploy.includes("persistent:true"));
        template.guide = guide;
        template.githubUrl = `https://github.com/${templateSource.repoOwner}/${templateSource.repoName}/blob/${templateSource.repoVersion}/${templateSource.path}`;

        if (!template.logoUrl) {
          template.logoUrl = getLogoFromPath(template.path);
        }

        if (!template.summary) {
          template.summary = getLinuxServerTemplateSummary(readme);
        }

        template.id = `${templateSource.repoOwner}-${templateSource.repoName}-${templateSource.path}`;
        template.path = template.id; // For compatibility with old deploy tool versions (TODO: remove in future)

        category.templates.push(template);

        console.log(category.title + " - " + template.name);
      } catch (err) {
        console.warn(`Skipped ${templateSource.name} because of error: ${err.message || err}`);
      }
    }
  }

  // Remove templates without "README.md" and "deploy.yml"
  categories.forEach(c => {
    c.templates = c.templates.filter(x => x.readme && x.deploy);
  });
  categories = categories.filter(x => x.templates?.length > 0);

  //console.log("Requests remaining: " + reqRemaining);

  return categories;
}

export async function fetchTemplatesInfo(octokit: Octokit, categories: Category[]) {
  for (const category of categories) {
    for (const templateSource of category.templateSources) {
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

        githubRequestsRemaining = response.headers["x-ratelimit-remaining"];

        const readme = await findFileContentAsync("README.md", response.data);
        const deploy = await findFileContentAsync(["deploy.yaml", "deploy.yml"], response.data);
        const guide = await findFileContentAsync("GUIDE.md", response.data);
        const config = await findFileContentAsync("config.json", response.data);
        const _config = config ? JSON.parse(config) : { ssh: false, logoUrl: "" };

        const template: Template = {
          name: templateSource.name,
          path: templateSource.path,
          logoUrl: templateSource.logoUrl,
          summary: templateSource.summary,
          config: _config
        };

        template.readme = readme && replaceLinks(readme, templateSource.repoOwner, templateSource.repoName, templateSource.repoVersion, templateSource.path);
        template.deploy = deploy;
        template.persistentStorageEnabled = deploy && (deploy.includes("persistent: true") || deploy.includes("persistent:true"));
        template.guide = guide;
        template.githubUrl = `https://github.com/${templateSource.repoOwner}/${templateSource.repoName}/blob/${templateSource.repoVersion}/${templateSource.path}`;

        if (!template.logoUrl) {
          const logoFromPath = getLogoFromPath(template.path);
          const configLogo = _config?.logoUrl || "";
          template.logoUrl = logoFromPath || configLogo;
        }

        if (!template.summary) {
          template.summary = getTemplateSummary(readme);
        }

        template.id = `${templateSource.repoOwner}-${templateSource.repoName}-${templateSource.path}`;
        template.path = template.id; // For compatibility with old deploy tool versions (TODO: remove in future)

        category.templates.push(template);

        console.log(category.title + " - " + template.name);
      } catch (err) {
        console.warn(`Skipped ${templateSource.name} because of error: ${err.message || err}`);
      }
    }
  }

  // Remove templates without "README.md" and "deploy.yml"
  categories.forEach(c => {
    c.templates = c.templates.filter(x => x.readme && x.deploy);
  });
  categories = categories.filter(x => x.templates?.length > 0);

  //console.log("Requests remaining: " + reqRemaining);

  return categories;
}

// Find a github file by name and dowload it
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
