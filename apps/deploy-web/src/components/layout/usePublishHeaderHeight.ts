"use client";
import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * Published to `:root` so the layout can offset content by the header's *actual* height. The header grows
 * when the top banner wraps to multiple lines on small screens; a fixed guess would hide content behind it.
 */
export const APP_HEADER_HEIGHT_VAR = "--app-header-height";

/** Keeps {@link APP_HEADER_HEIGHT_VAR} in sync with the header's rendered height as the banner appears, wraps, or clears. */
export function usePublishHeaderHeight(ref: RefObject<HTMLElement>) {
  useEffect(
    function publishHeaderHeightAsCssVar() {
      const header = ref.current;
      if (!header) return;

      const root = document.documentElement;
      function syncHeight() {
        root.style.setProperty(APP_HEADER_HEIGHT_VAR, `${header!.offsetHeight}px`);
      }

      syncHeight();
      const observer = new ResizeObserver(syncHeight);
      observer.observe(header);
      return function stopPublishingHeaderHeight() {
        observer.disconnect();
      };
    },
    [ref]
  );
}
