"use client";
import type { RefCallback } from "react";
import { useEffect, useRef, useState } from "react";

/** Slack below the fold that still counts as reading the latest message, so sub-pixel rounding never stops the follow. */
const PINNED_DISTANCE_PX = 48;

function scrollToBottom(scrollArea: HTMLElement) {
  scrollArea.scrollTop = scrollArea.scrollHeight;
}

function isNearBottom(scrollArea: HTMLElement) {
  return scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight <= PINNED_DISTANCE_PX;
}

/** Keeps the scroll area at the bottom while its content grows, unless the reader scrolled up; a new `followKey` snaps back to the bottom. */
export function useFollowLatestContent(followKey: unknown): { scrollAreaRef: RefCallback<HTMLElement>; contentRef: RefCallback<HTMLElement> } {
  const [scrollArea, setScrollArea] = useState<HTMLElement | null>(null);
  const [content, setContent] = useState<HTMLElement | null>(null);
  const isPinnedRef = useRef(true);

  useEffect(
    function trackWhetherTheReaderIsAtTheBottom() {
      if (!scrollArea) return;
      function updatePinned() {
        isPinnedRef.current = isNearBottom(scrollArea!);
      }
      scrollArea.addEventListener("scroll", updatePinned, { passive: true });
      return function stopTrackingTheReader() {
        scrollArea.removeEventListener("scroll", updatePinned);
      };
    },
    [scrollArea]
  );

  useEffect(
    function followGrowingContent() {
      if (!scrollArea || !content) return;
      const observer = new ResizeObserver(function followIfPinned() {
        if (isPinnedRef.current) scrollToBottom(scrollArea);
      });
      observer.observe(content);
      return function stopFollowingContent() {
        observer.disconnect();
      };
    },
    [scrollArea, content]
  );

  useEffect(
    function snapToTheBottomOnNewFollowKey() {
      if (!scrollArea) return;
      isPinnedRef.current = true;
      scrollToBottom(scrollArea);
    },
    [scrollArea, followKey]
  );

  return { scrollAreaRef: setScrollArea, contentRef: setContent };
}
