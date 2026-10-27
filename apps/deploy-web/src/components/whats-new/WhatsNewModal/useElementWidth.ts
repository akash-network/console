"use client";
import { useLayoutEffect, useState } from "react";

export function useElementWidth() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(
    function followElementWidth() {
      if (!element) return;
      const observer = new ResizeObserver(() => setWidth(element.clientWidth));
      observer.observe(element);
      setWidth(element.clientWidth);
      return function stopFollowing() {
        observer.disconnect();
      };
    },
    [element]
  );

  return { measureRef: setElement, width };
}
