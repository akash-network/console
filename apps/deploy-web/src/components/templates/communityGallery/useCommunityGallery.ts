import { useMemo } from "react";

import type { EnhancedTemplateCategory } from "@src/queries/useTemplateQuery";
import { useCommunityTemplates } from "@src/queries/useUserTemplateQueries";
import type { CommunityTemplateGallery } from "@src/types/marketplace-template";
import {
  buildGalleryEntries,
  countGallerySources,
  filterGalleryEntries,
  listGalleryCategories,
  listGalleryUseCaseFilters,
  MIN_TRENDING_TEMPLATES,
  selectTrendingEntries,
  sortGalleryEntries
} from "./galleryEntries";
import type { GalleryFirstPage } from "./galleryFirstPage";
import type { GalleryView } from "./galleryView";
import { isSameGalleryView } from "./galleryView";

interface CommunityTemplatesQuery {
  data: CommunityTemplateGallery | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}

export const DEPENDENCIES: { useCommunityTemplates: (options: { enabled: boolean }) => CommunityTemplatesQuery } = { useCommunityTemplates };

export interface CommunityGalleryInput {
  isEnabled: boolean;
  categories: EnhancedTemplateCategory[];
  /** True until the awesome-akash list has answered for the first time. */
  isLoadingCategories?: boolean;
  view: GalleryView;
  /** The first screen a server render worked out, shown until both lists have loaded in the browser. */
  firstPage?: GalleryFirstPage;
}

/** Only a community view with no category can be built from the community list alone, since a category is resolved against the awesome-akash list. */
function needsAwesomeAkashList(view: GalleryView): boolean {
  return view.source !== "community" || !!view.category;
}

/** Null while the marketplace is off, so the gallery keeps showing the awesome-akash sections alone. */
export function useCommunityGallery(
  { isEnabled, categories, isLoadingCategories = false, view, firstPage }: CommunityGalleryInput,
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
) {
  const communityQuery = dependencies.useCommunityTemplates({ enabled: isEnabled });
  const community = communityQuery.data;
  const refetchCommunity = communityQuery.refetch;

  const entries = useMemo(() => (isEnabled ? buildGalleryEntries({ categories, community }) : []), [isEnabled, categories, community]);
  const galleryCategories = useMemo(() => listGalleryCategories(categories, entries), [categories, entries]);
  const selectedCategory = galleryCategories.find(title => title === view.category) ?? null;
  const filters = useMemo(
    () => listGalleryUseCaseFilters({ entries, categories: galleryCategories, source: view.source }),
    [entries, galleryCategories, view.source]
  );
  const sourceCounts = useMemo(() => countGallerySources(entries, selectedCategory), [entries, selectedCategory]);
  const sortedEntries = useMemo(() => sortGalleryEntries(entries, view.sort), [entries, view.sort]);
  const shownEntries = useMemo(
    () => filterGalleryEntries(sortedEntries, { source: view.source, category: selectedCategory, search: view.search }),
    [sortedEntries, view.source, selectedCategory, view.search]
  );
  const minTrendingTemplates = community?.trendingRowMinTemplates ?? MIN_TRENDING_TEMPLATES;
  const trendingEntries = useMemo(
    () => selectTrendingEntries(filterGalleryEntries(entries, { source: view.source, category: selectedCategory, search: "" }), minTrendingTemplates),
    [entries, view.source, selectedCategory, minTrendingTemplates]
  );

  if (!isEnabled) return null;

  const retryCommunity = () => void refetchCommunity();
  const isAwaitingCategories = categories.length === 0 && (isLoadingCategories || needsAwesomeAkashList(view));
  const isAwaitingLists = communityQuery.isLoading || isAwaitingCategories;

  if (firstPage && isAwaitingLists && isSameGalleryView(firstPage.view, view)) {
    return {
      selectedCategory: firstPage.selectedCategory,
      filters: firstPage.filters,
      sourceCounts: firstPage.sourceCounts,
      shownEntries: firstPage.shownEntries,
      trendingEntries: firstPage.trendingEntries,
      isShowingFirstPage: true,
      isLoadingCommunity: false,
      hasCommunityFailed: false,
      retryCommunity
    };
  }

  return {
    selectedCategory,
    filters,
    sourceCounts,
    shownEntries,
    trendingEntries: view.search.trim() ? [] : trendingEntries,
    isShowingFirstPage: false,
    isLoadingCommunity: communityQuery.isLoading,
    hasCommunityFailed: communityQuery.isError,
    retryCommunity
  };
}

export type CommunityGallery = NonNullable<ReturnType<typeof useCommunityGallery>>;
