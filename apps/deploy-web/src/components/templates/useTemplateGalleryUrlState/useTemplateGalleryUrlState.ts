import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import debounce from "lodash/debounce";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { useRouter, useSearchParams } from "next/navigation";

import type { GallerySort, GallerySource } from "@src/components/templates/communityGallery/galleryView";
import { DEFAULT_GALLERY_SORT, DEFAULT_GALLERY_SOURCE, GALLERY_SORTS, GALLERY_SOURCES } from "@src/components/templates/communityGallery/galleryView";
import { UrlService } from "@src/utils/urlUtils";

/** Long enough to skip most keystrokes, short enough that a link copied right after typing still carries the search. */
const SEARCH_URL_DELAY_MS = 300;

/** The pages router answers null until it is ready, which the app router typing leaves out. */
export const DEPENDENCIES: { useRouter: typeof useRouter; useSearchParams: () => ReadonlyURLSearchParams | null } = { useRouter, useSearchParams };

interface GalleryUrlState {
  category: string | null;
  search: string;
  source: GallerySource;
  sort: GallerySort;
}

/** Keeps the gallery's category, search, source and sort in the link, and follows the link when something else changes it, such as the Templates nav entry. */
export function useTemplateGalleryUrlState(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const router = dependencies.useRouter();
  const searchParams = dependencies.useSearchParams();
  const urlCategory = searchParams?.get("category") || null;
  const urlSearch = searchParams?.get("search") ?? "";
  const urlSource = GALLERY_SOURCES.find(source => source === searchParams?.get("source")) ?? DEFAULT_GALLERY_SOURCE;
  const urlSort = GALLERY_SORTS.find(sort => sort === searchParams?.get("sort")) ?? DEFAULT_GALLERY_SORT;
  const [state, setState] = useState<GalleryUrlState>({ category: urlCategory, search: urlSearch, source: urlSource, sort: urlSort });
  const lastSeenUrl = useRef<GalleryUrlState>({ category: urlCategory, search: urlSearch, source: urlSource, sort: urlSort });
  /** The page's own writes the link has yet to show, oldest first; a write back to the link it is on never shows as a change, so it replaces this queue instead of joining it. */
  const unsettledWrites = useRef<GalleryUrlState[]>([]);

  const writeUrl = useCallback(
    (next: GalleryUrlState) => {
      const isLinkAlreadyThere = isSameUrlState(next, lastSeenUrl.current);
      if (isLinkAlreadyThere && unsettledWrites.current.length === 0) return;

      unsettledWrites.current = isLinkAlreadyThere ? [] : [...unsettledWrites.current, next];
      router.replace(UrlService.templates(next.category, next.search, { source: next.source, sort: next.sort }));
    },
    [router]
  );
  const writeUrlLater = useMemo(() => debounce(writeUrl, SEARCH_URL_DELAY_MS), [writeUrl]);

  useEffect(
    function followUrlChangedElsewhere() {
      const url = { category: urlCategory, search: urlSearch, source: urlSource, sort: urlSort };
      lastSeenUrl.current = url;

      const settledIndex = unsettledWrites.current.findIndex(write => isSameUrlState(write, url));
      if (settledIndex !== -1) {
        unsettledWrites.current.splice(0, settledIndex + 1);
        return;
      }

      writeUrlLater.cancel();
      unsettledWrites.current = [];
      setState(current => (isSameUrlState(current, url) ? current : url));
    },
    [urlCategory, urlSearch, urlSource, urlSort, writeUrlLater]
  );

  useEffect(
    function cancelPendingUrlWrite() {
      return function cancelPending() {
        writeUrlLater.cancel();
      };
    },
    [writeUrlLater]
  );

  const writeNow = (change: Partial<GalleryUrlState>) => {
    setState(current => ({ ...current, ...change }));
    writeUrlLater.cancel();
    writeUrl({ ...state, ...change });
  };

  const selectCategory = (category: string | null) => writeNow({ category });

  const selectSource = (source: GallerySource) => writeNow({ source });

  const selectSort = (sort: GallerySort) => writeNow({ sort });

  const changeSearch = (search: string) => {
    setState(current => ({ ...current, search }));
    writeUrlLater({ ...state, search });
  };

  const clearSearch = () => writeNow({ search: "" });

  return { ...state, selectCategory, selectSource, selectSort, changeSearch, clearSearch };
}

function isSameUrlState(a: GalleryUrlState, b: GalleryUrlState): boolean {
  return a.category === b.category && a.search === b.search && a.source === b.source && a.sort === b.sort;
}
