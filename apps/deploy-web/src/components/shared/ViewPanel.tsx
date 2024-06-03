"use client";
import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";

import { useWindowSize } from "@src/hooks/useWindowSize";

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
          height = Math.abs(boundingRect.top - window.innerHeight);
        } else if (ratio) {
          height = Math.round(boundingRect.width * ratio);
        } else {
          height = "auto";
        }

        if (offset && typeof height === "number") {
          height -= offset;
        }

        setHeight(height);
      } catch (error) {
        setHeight("auto");
      }
    }
  }, [windowSize, bottomElementId, isSameAsParent, offset]);

  return (
    <div ref={ref} style={{ height, ...style }} className={className}>
      {height ? children : null}
    </div>
  );
};

export default ViewPanel;
