import type { TemplateHardware } from "@akashnetwork/http-sdk";

import type { UseCaseFilter } from "@src/components/templates/templateGalleryModel";
import { promotionRank, toSearchTerms } from "@src/components/templates/templateGalleryModel";
import type { EnhancedTemplateCategory, TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import type { CommunityTemplateCard, CommunityTemplateGallery, CommunityTemplateUsage, TemplateScores } from "@src/types/marketplace-template";
import type { GallerySort, GallerySource } from "./galleryView";

export const GALLERY_PAGE_SIZE = 24;

/** A shorter row reads as an empty shelf, so it hides instead. */
export const MIN_TRENDING_TEMPLATES = 3;
export const MAX_TRENDING_TEMPLATES = 4;

/** Where a community template staff featured ranks among the gallery's own promoted templates, ahead of the recommended ones. */
const STAFF_FEATURED_RANK = -1;
const UNPROMOTED_RANK = 2;

const AWESOME_AKASH_PUBLISHER = "Akash Network";

const NO_USAGE: CommunityTemplateUsage = { deploys: 0, stillUpAfter24h: null, forks: 0 };
const NO_SCORES: TemplateScores = { popular: null, trending: null, isTrending: false };

/** The scores API may widen each awesome-akash usage with its scores; until then they rank by deploys. */
type OfficialUsage = CommunityTemplateUsage & { scores?: TemplateScores };

export interface GalleryEntry {
  key: string;
  origin: "awesome-akash" | "console";
  id: string;
  title: string;
  summary: string | null;
  icon: string | null;
  categories: string[];
  isOfficial: boolean;
  isFeatured: boolean;
  /** Null for an awesome-akash template, which Akash publishes. */
  publisher: CommunityTemplateCard["publisher"] | null;
  resources: TemplateHardware | null;
  versionCount: number | null;
  /** Milliseconds since the epoch, null for an awesome-akash template, which records no publish date. */
  publishedAt: number | null;
  usage: CommunityTemplateUsage;
  scores: TemplateScores;
  curatedRank: number;
  searchText: string;
}

export function buildGalleryEntries(input: { categories: EnhancedTemplateCategory[]; community: CommunityTemplateGallery | undefined }): GalleryEntry[] {
  return [...toAwesomeAkashEntries(input.categories, input.community?.officialUsage ?? {}), ...(input.community?.templates ?? []).map(toCommunityEntry)];
}

/** A template listed under several categories becomes one entry carrying all of them. */
function toAwesomeAkashEntries(categories: EnhancedTemplateCategory[], officialUsage: Record<string, OfficialUsage>): GalleryEntry[] {
  const entriesById = new Map<string, GalleryEntry>();

  for (const category of categories) {
    for (const template of category.templates) {
      const listed = entriesById.get(template.id);
      if (listed) {
        listed.categories.push(category.title);
      } else {
        entriesById.set(template.id, toAwesomeAkashEntry(template, category.title, officialUsage));
      }
    }
  }

  return [...entriesById.values()];
}

function toAwesomeAkashEntry(template: TemplateOutputSummaryWithCategory, category: string, officialUsage: Record<string, OfficialUsage>): GalleryEntry {
  const usage = Object.hasOwn(officialUsage, template.id) ? officialUsage[template.id] : undefined;

  return {
    key: `awesome-akash:${template.id}`,
    origin: "awesome-akash",
    id: template.id,
    title: template.name,
    summary: template.summary,
    icon: null,
    categories: [category],
    isOfficial: true,
    isFeatured: false,
    publisher: null,
    resources: template.hardware ?? null,
    versionCount: null,
    publishedAt: null,
    usage: usage ? { deploys: usage.deploys, stillUpAfter24h: usage.stillUpAfter24h, forks: usage.forks } : NO_USAGE,
    scores: usage?.scores ?? NO_SCORES,
    curatedRank: promotionRank(template),
    searchText: toSearchText(template.name, template.summary, AWESOME_AKASH_PUBLISHER)
  };
}

function toCommunityEntry(template: CommunityTemplateCard): GalleryEntry {
  return {
    key: `console:${template.id}`,
    origin: "console",
    id: template.id,
    title: template.title,
    summary: template.summary,
    icon: template.icon,
    categories: template.categories,
    isOfficial: template.isOfficial,
    isFeatured: template.isFeatured,
    publisher: template.publisher,
    resources: template.resources,
    versionCount: template.versionCount,
    publishedAt: new Date(template.publishedAt).getTime(),
    usage: template.usage,
    scores: template.scores,
    curatedRank: template.isFeatured ? STAFF_FEATURED_RANK : UNPROMOTED_RANK,
    searchText: toSearchText(template.title, template.summary, template.publisher.name)
  };
}

function toSearchText(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(part => !!part)
    .join(" ")
    .toLowerCase();
}

/** The awesome-akash categories keep their order; a category only community templates use follows, alphabetically. */
export function listGalleryCategories(categories: EnhancedTemplateCategory[], entries: GalleryEntry[]): string[] {
  const listed = categories.map(category => category.title);
  const communityOnly = new Set(entries.flatMap(entry => entry.categories).filter(title => !listed.includes(title)));

  return [...listed, ...[...communityOnly].sort((a, b) => a.localeCompare(b))];
}

/** Counts follow the source filter and ignore the search, the way the use case counts always have. */
export function listGalleryUseCaseFilters(input: { entries: GalleryEntry[]; categories: string[]; source: GallerySource }): UseCaseFilter[] {
  const shown = input.entries.filter(entry => isFromSource(entry, input.source));

  return [
    { category: null, label: "All", count: shown.length },
    ...input.categories.map(title => ({ category: title, label: title, count: shown.filter(entry => entry.categories.includes(title)).length }))
  ];
}

export function countGallerySources(entries: GalleryEntry[], category: string | null): Record<GallerySource, number> {
  const inCategory = entries.filter(entry => isInCategory(entry, category));
  const official = inCategory.filter(entry => entry.isOfficial).length;

  return { all: inCategory.length, official, community: inCategory.length - official };
}

export function sortGalleryEntries(entries: GalleryEntry[], sort: GallerySort): GalleryEntry[] {
  const sortValueOf = SORT_VALUES[sort];

  return [...entries].sort(
    (a, b) =>
      highestFirst(sortValueOf(a), sortValueOf(b)) ||
      highestFirst(popularityOf(a), popularityOf(b)) ||
      a.curatedRank - b.curatedRank ||
      a.title.localeCompare(b.title)
  );
}

export function filterGalleryEntries(entries: GalleryEntry[], filter: { source: GallerySource; category: string | null; search: string }): GalleryEntry[] {
  const searchTerms = toSearchTerms(filter.search);

  return entries.filter(
    entry => isFromSource(entry, filter.source) && isInCategory(entry, filter.category) && searchTerms.every(term => entry.searchText.includes(term))
  );
}

export function selectTrendingEntries(entries: GalleryEntry[]): GalleryEntry[] {
  const trending = entries.filter(entry => entry.scores.isTrending);
  if (trending.length < MIN_TRENDING_TEMPLATES) return [];

  return sortGalleryEntries(trending, "trending").slice(0, MAX_TRENDING_TEMPLATES);
}

function isFromSource(entry: GalleryEntry, source: GallerySource): boolean {
  return source === "all" || entry.isOfficial === (source === "official");
}

function isInCategory(entry: GalleryEntry, category: string | null): boolean {
  return category === null || entry.categories.includes(category);
}

function popularityOf(entry: GalleryEntry): number {
  return entry.scores.popular ?? entry.usage.deploys;
}

/** An awesome-akash template has no publish date, so Newest lists every dated template first and then these by popularity. */
const UNDATED = Number.NEGATIVE_INFINITY;

const SORT_VALUES: Record<GallerySort, (entry: GalleryEntry) => number> = {
  popular: popularityOf,
  trending: entry => entry.scores.trending ?? entry.usage.deploys,
  newest: entry => entry.publishedAt ?? UNDATED
};

function highestFirst(a: number, b: number): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}
