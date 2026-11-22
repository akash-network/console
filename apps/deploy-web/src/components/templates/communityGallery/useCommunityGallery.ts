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
import type { GallerySort, GallerySource } from "./galleryView";

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
  view: { category: string | null; search: string; source: GallerySource; sort: GallerySort };
}

/** Null while the marketplace is off, so the gallery keeps showing the awesome-akash sections alone. */
export function useCommunityGallery({ isEnabled, categories, view }: CommunityGalleryInput, dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
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

  return {
    selectedCategory,
    filters,
    sourceCounts,
    shownEntries,
    trendingEntries: view.search.trim() ? [] : trendingEntries,
    isLoadingCommunity: communityQuery.isLoading,
    hasCommunityFailed: communityQuery.isError,
    retryCommunity: () => void refetchCommunity()
  };
}

export type CommunityGallery = NonNullable<ReturnType<typeof useCommunityGallery>>;
