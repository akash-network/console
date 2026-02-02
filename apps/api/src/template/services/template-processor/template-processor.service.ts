import { markdownToTxt } from "markdown-to-txt";

import { safeParseJson } from "@src/utils/json";
import { getLogoFromPath } from "@src/utils/templateReposLogos";
import { isUrlAbsolute } from "@src/utils/urls";
import type { Category, Template, TemplateConfig, TemplateSource } from "../../types/template";

export class TemplateProcessorService {
  mergeTemplateCategories(...categories: Category[][]): MergedCategory[] {
    const mergedCategories: MergedCategory[] = [];
    for (const category of categories.flat()) {
      let categoryIndex = mergedCategories.findIndex(c => c.title.toLowerCase() === category.title.toLowerCase());
      if (categoryIndex !== -1) {
        const existingCategory = mergedCategories[categoryIndex];
        existingCategory.templates = (existingCategory.templates || []).concat(category.templates || []);
      } else {
        categoryIndex = mergedCategories.length;
        const categoryClone = JSON.parse(JSON.stringify(category));
        categoryClone.templates ??= [];
        mergedCategories.push(categoryClone);
      }
    }

    return mergedCategories;
  }

  getTemplateSummary(readme: string): string | null {
    if (!readme) return null;

    const markdown = readme
      .replace(/!\[.*\]\(.+\)\n*/g, "") // Remove images
      .replace(/^#+ .*\n+/g, ""); // Remove first header

    const readmeTxt = markdownToTxt(markdown).trim();
    const maxLength = 200;
    return readmeTxt.length > maxLength ? readmeTxt.substring(0, maxLength - 3).trim() + "..." : readmeTxt;
  }

  getLinuxServerTemplateSummary(readme: string): string | null {
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
    return readmeTxt.length > maxLength ? readmeTxt.substring(0, maxLength - 3).trim() + "..." : readmeTxt;
  }

  replaceLinks(markdown: string, owner: string, repo: string, version: string, folder: string): string {
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

  removeComments(markdown: string): string {
    return markdown.replace(/<!--.+-->/g, "");
  }

  processTemplate(
    templateSource: TemplateSource,
    readme: string | null,
    deploy: string | null,
    guide: string | null,
    configJsonText: string | null
  ): Template | null {
    if (!readme || !deploy) return null;

    const id = `${templateSource.repoOwner}-${templateSource.repoName}-${templateSource.path.replace(/[\\/]+/g, "-")}`;
    const defaultConfig: TemplateConfig = { ssh: false, logoUrl: "" };
    const template = {
      id,
      name: templateSource.name,
      path: id, // For compatibility with old deploy tool versions (TODO: remove in future)
      logoUrl: templateSource.logoUrl || "",
      summary: templateSource.summary || "",
      config: (configJsonText ? safeParseJson(configJsonText, defaultConfig) : defaultConfig) as TemplateConfig,
      readme: this.replaceLinks(readme, templateSource.repoOwner, templateSource.repoName, templateSource.repoVersion, templateSource.path),
      deploy,
      persistentStorageEnabled: !!deploy && (deploy.includes("persistent: true") || deploy.includes("persistent:true")),
      guide: guide || undefined,
      githubUrl: `https://github.com/${templateSource.repoOwner}/${templateSource.repoName}/blob/${templateSource.repoVersion}/${templateSource.path}`
    };

    if (!template.logoUrl) {
      const logoFromPath = getLogoFromPath(template.path);
      const configLogo = template.config.logoUrl || "";
      template.logoUrl = logoFromPath || configLogo;
    }

    if (!template.summary) {
      template.summary = this.getTemplateSummary(readme) || "";
    }

    return template;
  }
}

export type MergedCategory = Omit<Category, "templates"> & { templates: Template[] };
