import type { EnhancedTemplateCategory, TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";

/** Promoted ahead of every tag, in this order. */
const FEATURED_TEMPLATE_IDS = ["akash-network-awesome-akash-Razer-AIKit"];

export interface UseCaseFilter {
  category: string | null;
  label: string;
  count: number;
}

export interface TemplateSection {
  title: string;
  templates: TemplateOutputSummaryWithCategory[];
}

export function isPopularTemplate(template: TemplateOutputSummaryWithCategory): boolean {
  return template.tags?.includes("popular") ?? false;
}

/** A template listed under several categories counts once towards All. */
export function listUseCaseFilters(categories: EnhancedTemplateCategory[]): UseCaseFilter[] {
  const uniqueTemplateIds = new Set(categories.flatMap(category => category.templates.map(template => template.id)));

  return [
    { category: null, label: "All", count: uniqueTemplateIds.size },
    ...categories.map(category => ({ category: category.title, label: category.title, count: category.templates.length }))
  ];
}

/** A category missing from the list, such as one renamed since a link was shared, falls back to All. */
export function findSelectedCategory(categories: EnhancedTemplateCategory[], category: string | null | undefined): string | null {
  return categories.find(candidate => candidate.title === category)?.title ?? null;
}

export function selectTemplateSections(input: { categories: EnhancedTemplateCategory[]; category: string | null; search: string }): TemplateSection[] {
  const searchTerms = toSearchTerms(input.search);

  return input.categories
    .filter(category => input.category === null || category.title === input.category)
    .map(category => ({
      title: category.title,
      templates: sortByPromotion(category.templates).filter(template => matchesEverySearchTerm(template, searchTerms))
    }))
    .filter(section => section.templates.length > 0);
}

function toSearchTerms(search: string): string[] {
  return search.toLowerCase().match(/\S+/g) ?? [];
}

function matchesEverySearchTerm(template: TemplateOutputSummaryWithCategory, searchTerms: string[]): boolean {
  const searchable = `${template.name ?? ""} ${template.summary ?? ""}`.toLowerCase();
  return searchTerms.every(term => searchable.includes(term));
}

function sortByPromotion(templates: TemplateOutputSummaryWithCategory[]): TemplateOutputSummaryWithCategory[] {
  return [...templates].sort((a, b) => promotionRank(a) - promotionRank(b));
}

function promotionRank(template: TemplateOutputSummaryWithCategory): number {
  const featuredIndex = FEATURED_TEMPLATE_IDS.indexOf(template.id);
  if (featuredIndex !== -1) return featuredIndex - FEATURED_TEMPLATE_IDS.length;
  if (template.tags?.includes("recommended")) return 0;
  if (isPopularTemplate(template)) return 1;
  return 2;
}
