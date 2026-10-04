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
  /** The page's own writes the link has yet to show, oldest first; a link matching one of them is the page's own echo, not a navigation to follow. */
  const unsettledWrites = useRef<GalleryUrlState[]>([]);

  const writeUrl = useCallback(
    (next: GalleryUrlState) => {
      unsettledWrites.current.push(next);
      router.replace(UrlService.templates(next.category, next.search));
    },
    [router]
  );
  const writeUrlLater = useMemo(() => debounce(writeUrl, SEARCH_URL_DELAY_MS), [writeUrl]);

  useEffect(
    function followUrlChangedElsewhere() {
      const settledIndex = unsettledWrites.current.findIndex(write => write.category === urlCategory && write.search === urlSearch);
      if (settledIndex !== -1) {
        unsettledWrites.current.splice(0, settledIndex + 1);
        return;
      }

      writeUrlLater.cancel();
      setState(current => (current.category === urlCategory && current.search === urlSearch ? current : { category: urlCategory, search: urlSearch }));
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
