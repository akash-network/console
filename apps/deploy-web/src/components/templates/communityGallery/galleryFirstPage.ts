import type { UseCaseFilter } from "@src/components/templates/templateGalleryModel";
import type { EnhancedTemplateCategory } from "@src/queries/useTemplateQuery";
import type { CommunityTemplateGallery } from "@src/types/marketplace-template";
import type { GalleryEntry } from "./galleryEntries";
import {
  buildGalleryEntries,
  countGallerySources,
  filterGalleryEntries,
  GALLERY_PAGE_SIZE,
  listGalleryCategories,
  listGalleryUseCaseFilters,
  selectTrendingEntries,
  sortGalleryEntries
} from "./galleryEntries";
import type { GallerySource, GalleryView } from "./galleryView";

/**
 * What the gallery shows before the browser has loaded its lists: the first screen of one view with its real counts, worked out on the server.
 * The lists themselves run to a thousand cards and carry every awesome-akash SDL, so they stay out of the page.
 */
export interface GalleryFirstPage {
  view: GalleryView;
  selectedCategory: string | null;
  filters: UseCaseFilter[];
  sourceCounts: Record<GallerySource, number>;
  shownEntries: GalleryEntry[];
  trendingEntries: GalleryEntry[];
}

export function buildGalleryFirstPage(input: {
  categories: EnhancedTemplateCategory[];
  community: CommunityTemplateGallery;
  view: GalleryView;
}): GalleryFirstPage {
  const { categories, community, view } = input;
  const entries = buildGalleryEntries({ categories, community });
  const galleryCategories = listGalleryCategories(categories, entries);
  const selectedCategory = galleryCategories.find(title => title === view.category) ?? null;
  const shownEntries = filterGalleryEntries(sortGalleryEntries(entries, view.sort), { source: view.source, category: selectedCategory, search: view.search });

  return {
    view,
    selectedCategory,
    filters: listGalleryUseCaseFilters({ entries, categories: galleryCategories, source: view.source }),
    sourceCounts: countGallerySources(entries, selectedCategory),
    shownEntries: shownEntries.slice(0, GALLERY_PAGE_SIZE),
    trendingEntries: view.search.trim()
      ? []
      : selectTrendingEntries(filterGalleryEntries(entries, { source: view.source, category: selectedCategory, search: "" }), community.trendingRowMinTemplates)
  };
}
