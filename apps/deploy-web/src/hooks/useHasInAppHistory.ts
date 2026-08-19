import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/router";

import routeStore from "@src/store/routeStore";

/**
 * Next stamps a fresh `key` on every history entry it pushes and hands the original one back on
 * back/forward, so it identifies an entry across the whole session. Absent outside the Next router,
 * in which case depth stops moving and callers fall back to pushing a route, which is the safe side.
 */
const readHistoryEntryKey = () => (window.history.state as { key?: string } | null)?.key;

export const DEPENDENCIES = { useRouter };

/**
 * Tracks how deep the current history entry sits inside the app. Must be mounted app-wide and exactly
 * once: a component that subscribes only when it renders would attach after the navigation it needs
 * to observe.
 *
 * Depth is keyed off the history entry rather than counted up, so returning to an earlier entry
 * restores that entry's depth instead of leaving a flag stuck on.
 */
export const useTrackInAppNavigation = (d: typeof DEPENDENCIES = DEPENDENCIES) => {
  const router = d.useRouter();
  const setInAppHistoryDepth = useSetAtom(routeStore.inAppHistoryDepth);

  useEffect(function trackInAppHistoryDepth() {
    const depthByHistoryEntryKey = new Map<string, number>();
    let currentDepth = 0;

    const sessionEntryKey = readHistoryEntryKey();
    if (sessionEntryKey) depthByHistoryEntryKey.set(sessionEntryKey, currentDepth);
    setInAppHistoryDepth(currentDepth);

    const syncDepthWithHistoryEntry = () => {
      const entryKey = readHistoryEntryKey();
      if (!entryKey) return;

      const knownDepth = depthByHistoryEntryKey.get(entryKey);

      if (knownDepth === undefined) {
        currentDepth += 1;
        depthByHistoryEntryKey.set(entryKey, currentDepth);
      } else {
        currentDepth = knownDepth;
      }

      setInAppHistoryDepth(currentDepth);
    };

    router.events?.on("routeChangeComplete", syncDepthWithHistoryEntry);
    router.events?.on("hashChangeComplete", syncDepthWithHistoryEntry);
    window.addEventListener("popstate", syncDepthWithHistoryEntry);

    return () => {
      router.events?.off("routeChangeComplete", syncDepthWithHistoryEntry);
      router.events?.off("hashChangeComplete", syncDepthWithHistoryEntry);
      window.removeEventListener("popstate", syncDepthWithHistoryEntry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

/**
 * Whether `router.back()` is safe to call. False when the current page is where the SPA session started:
 * going back from there would leave the app entirely, so callers should push an in-app route instead.
 */
export const useHasInAppHistory = (): boolean => {
  return useAtomValue(routeStore.inAppHistoryDepth) > 0;
};
