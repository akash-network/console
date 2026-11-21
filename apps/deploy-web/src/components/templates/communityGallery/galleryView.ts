export const GALLERY_SOURCES = ["all", "official", "community"] as const;
export type GallerySource = (typeof GALLERY_SOURCES)[number];
export const DEFAULT_GALLERY_SOURCE: GallerySource = "all";

export const GALLERY_SORTS = ["popular", "trending", "newest"] as const;
export type GallerySort = (typeof GALLERY_SORTS)[number];
export const DEFAULT_GALLERY_SORT: GallerySort = "popular";

export interface GalleryView {
  category: string | null;
  search: string;
  source: GallerySource;
  sort: GallerySort;
}

type QueryValue = string | string[] | undefined;

/** Reads a link's query the way the gallery reads it in the browser, so a server render shows the same view. */
export function readGalleryView(query: Record<string, QueryValue>): GalleryView {
  return {
    category: firstValueOf(query.category) || null,
    search: firstValueOf(query.search) ?? "",
    source: GALLERY_SOURCES.find(source => source === firstValueOf(query.source)) ?? DEFAULT_GALLERY_SOURCE,
    sort: GALLERY_SORTS.find(sort => sort === firstValueOf(query.sort)) ?? DEFAULT_GALLERY_SORT
  };
}

export function isSameGalleryView(a: GalleryView, b: GalleryView): boolean {
  return a.category === b.category && a.search === b.search && a.source === b.source && a.sort === b.sort;
}

function firstValueOf(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
