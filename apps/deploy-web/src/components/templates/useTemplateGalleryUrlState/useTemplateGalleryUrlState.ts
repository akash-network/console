import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import debounce from "lodash/debounce";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { useRouter, useSearchParams } from "next/navigation";

import { UrlService } from "@src/utils/urlUtils";

/** Long enough to skip most keystrokes, short enough that a link copied right after typing still carries the search. */
const SEARCH_URL_DELAY_MS = 300;

/** The pages router answers null until it is ready, which the app router typing leaves out. */
export const DEPENDENCIES: { useRouter: typeof useRouter; useSearchParams: () => ReadonlyURLSearchParams | null } = { useRouter, useSearchParams };

interface GalleryUrlState {
  category: string | null;
  search: string;
}

/** Keeps the gallery's category and search in the link, and follows the link when something else changes it, such as the Templates nav entry. */
export function useTemplateGalleryUrlState(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const router = dependencies.useRouter();
  const searchParams = dependencies.useSearchParams();
  const urlCategory = searchParams?.get("category") || null;
  const urlSearch = searchParams?.get("search") ?? "";
  const [state, setState] = useState<GalleryUrlState>({ category: urlCategory, search: urlSearch });
  const lastSeenUrl = useRef<GalleryUrlState>({ category: urlCategory, search: urlSearch });
  /** The page's own writes the link has yet to show, oldest first; a write back to the link it is on never shows as a change, so it replaces this queue instead of joining it. */
  const unsettledWrites = useRef<GalleryUrlState[]>([]);

  const writeUrl = useCallback(
    (next: GalleryUrlState) => {
      const isLinkAlreadyThere = isSameUrlState(next, lastSeenUrl.current);
      if (isLinkAlreadyThere && unsettledWrites.current.length === 0) return;

      unsettledWrites.current = isLinkAlreadyThere ? [] : [...unsettledWrites.current, next];
      router.replace(UrlService.templates(next.category, next.search));
    },
    [router]
  );
  const writeUrlLater = useMemo(() => debounce(writeUrl, SEARCH_URL_DELAY_MS), [writeUrl]);

  useEffect(
    function followUrlChangedElsewhere() {
      const url = { category: urlCategory, search: urlSearch };
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
    [urlCategory, urlSearch, writeUrlLater]
  );

  useEffect(
    function cancelPendingUrlWrite() {
      return function cancelPending() {
        writeUrlLater.cancel();
      };
    },
    [writeUrlLater]
  );

  const selectCategory = (category: string | null) => {
    setState(current => ({ ...current, category }));
    writeUrlLater.cancel();
    writeUrl({ category, search: state.search });
  };

  const changeSearch = (search: string) => {
    setState(current => ({ ...current, search }));
    writeUrlLater({ category: state.category, search });
  };

  const clearSearch = () => {
    setState(current => ({ ...current, search: "" }));
    writeUrlLater.cancel();
    writeUrl({ category: state.category, search: "" });
  };

  return { category: state.category, search: state.search, selectCategory, changeSearch, clearSearch };
}

function isSameUrlState(a: GalleryUrlState, b: GalleryUrlState): boolean {
  return a.category === b.category && a.search === b.search;
}
