"use client";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import { useWindowSize } from "@src/hooks/useWindowSize";

const MIN_WIDE_VIEWPORT_WIDTH = 768;

/** A phone's page header can fill most of the screen, so there the panel keeps the larger share of the viewport and the page scrolls to it. */
const MIN_VIEWPORT_HEIGHT_SHARE = { narrow: 0.6, wide: 0.3 };

type Props = {
  // fixed height same as parent
  isSameAsParent?: boolean;
  // fixed height to a specific element, like the footer
  bottomElementId?: string;
  // fixed height with a ratio from the width like 2/3
  ratio?: number;
  stickToBottom?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
  className?: string;
  offset?: number;
};

export const ViewPanel: React.FunctionComponent<Props> = ({
  children,
  bottomElementId,
  isSameAsParent,
  ratio,
  className,
  offset,
  stickToBottom,
  style = {}
}) => {
  const windowSize = useWindowSize();
  const [height, setHeight] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);
  const containersResizedAt = useContainersResizedAt(ref, !!stickToBottom);

  useEffect(() => {
    if (windowSize.height) {
      try {
        const boundingRect = ref.current?.getBoundingClientRect() as DOMRect;
        let height: number | string;

        if (bottomElementId) {
          const bottomElementRect = document.getElementById(bottomElementId)?.getBoundingClientRect() as DOMRect;
          height = Math.abs(boundingRect.top - bottomElementRect.top);
        } else if (isSameAsParent) {
          const computedStyle = getComputedStyle(ref.current?.parentElement as HTMLElement);
          const parentRect = ref.current?.parentElement?.getBoundingClientRect() as DOMRect;
          height = parentRect.height - parseFloat(computedStyle.paddingBottom) - Math.abs(boundingRect.top - parentRect.top);
        } else if (stickToBottom) {
          height = heightToViewportBottom(ref.current as HTMLElement, boundingRect.top);
        } else if (ratio) {
          height = Math.round(boundingRect.width * ratio);
        } else {
          height = "auto";
        }

        if (offset && typeof height === "number") {
          height -= offset;
        }

        setHeight(height);
      } catch {
        setHeight("auto");
      }
    }
  }, [windowSize, bottomElementId, isSameAsParent, offset, containersResizedAt]);

  return (
    <div ref={ref} style={{ height, ...style }} className={className}>
      {height ? children : null}
    </div>
  );
};

/** What sits above the panel can settle after it measured, such as a banner or a web font, so it measures again whenever one of its containers resizes. */
function useContainersResizedAt(panelRef: RefObject<HTMLElement>, isWatching: boolean) {
  const [containersResizedAt, setContainersResizedAt] = useState(0);

  useEffect(
    function watchContainerResizes() {
      if (!isWatching) return;

      let frame = 0;
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(setContainersResizedAt);
      });
      for (let container = (panelRef.current as HTMLElement).parentElement; container; container = container.parentElement) {
        observer.observe(container);
      }

      return function stopWatching() {
        cancelAnimationFrame(frame);
        observer.disconnect();
      };
    },
    [panelRef, isWatching]
  );

  return containersResizedAt;
}

function heightToViewportBottom(panel: HTMLElement, top: number) {
  const minShare = window.innerWidth < MIN_WIDE_VIEWPORT_WIDTH ? MIN_VIEWPORT_HEIGHT_SHARE.narrow : MIN_VIEWPORT_HEIGHT_SHARE.wide;
  return Math.max(window.innerHeight - top - bottomPaddingAround(panel), Math.round(window.innerHeight * minShare));
}

/** The padding its containers keep below the panel would otherwise push the page past the viewport by that much. */
function bottomPaddingAround(panel: HTMLElement) {
  let padding = 0;
  for (let container = panel.parentElement; container; container = container.parentElement) {
    padding += parseFloat(getComputedStyle(container).paddingBottom) || 0;
  }
  return padding;
}
