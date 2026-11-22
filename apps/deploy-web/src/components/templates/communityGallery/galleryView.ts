export const GALLERY_SOURCES = ["all", "official", "community"] as const;
export type GallerySource = (typeof GALLERY_SOURCES)[number];
export const DEFAULT_GALLERY_SOURCE: GallerySource = "all";

export const GALLERY_SORTS = ["popular", "trending", "newest"] as const;
export type GallerySort = (typeof GALLERY_SORTS)[number];
export const DEFAULT_GALLERY_SORT: GallerySort = "popular";
