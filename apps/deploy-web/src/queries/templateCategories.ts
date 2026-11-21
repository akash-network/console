import type { TemplateCategory, TemplateOutputSummary } from "@akashnetwork/http-sdk";

export interface EnhancedTemplateCategory extends Omit<TemplateCategory, "templates"> {
  templates: TemplateOutputSummaryWithCategory[];
}

export interface TemplateOutputSummaryWithCategory extends TemplateOutputSummary {
  category: TemplateCategory["title"];
}

export interface CategoriesAndTemplates {
  categories: EnhancedTemplateCategory[];
  templates: TemplateOutputSummaryWithCategory[];
}

/** Drops the categories that list nothing and names each template's category on it, the shape the gallery works on in the browser and on the server. */
export function toCategoriesAndTemplates(listedCategories: TemplateCategory[] | undefined): CategoriesAndTemplates {
  if (!listedCategories) return { categories: [], templates: [] };

  const categories = listedCategories
    .filter(category => !!category.templates?.length)
    .map(category => ({ ...category, templates: category.templates.map(template => ({ ...template, category: category.title })) }));

  return { categories, templates: categories.flatMap(category => category.templates) };
}
