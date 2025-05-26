import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { dataFolderPath } from "@src/utils/constants";
import { env } from "@src/utils/env";
import { type FinalCategory, getTemplateGallery, type Template } from "./templatesCollector";

export const getCachedTemplatesGallery = (): Promise<FinalCategory[]> => {
  const GITHUB_PAT = env.GITHUB_PAT;
  if (!GITHUB_PAT) throw new Error("Cannot fetch templates without GitHub PAT");

  return cacheResponse(
    60 * 5,
    cacheKeys.getTemplates,
    () =>
      getTemplateGallery({
        githubPAT: GITHUB_PAT,
        dataFolderPath
      }),
    true
  );
};

export const getTemplateById = async (id: Required<Template>["id"]): Promise<Template | null> => {
  const templatesByCategory = await getCachedTemplatesGallery();
  for (const category of templatesByCategory) {
    const template = category.templates.find(template => template.id === id);
    if (template) return template;
  }

  return null;
};

export const getCachedTemplateById = (id: Required<Template>["id"]) =>
  cacheResponse(60 * 5, `${cacheKeys.getTemplates}.${id}`, () => getTemplateById(id), true);
