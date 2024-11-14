"use client";
import { CSSProperties } from "react";

import { cn } from "@src/utils/styleUtils";

type Props = {
  state: "active" | "closed" | string;
  style?: CSSProperties;
  size?: "small" | "medium";
  className?: string;
};

export const StatusPill: React.FunctionComponent<Props> = ({ state, style, size = "medium", className = "" }) => {
  return (
    <div
      style={style}
      className={cn(
        "rounded-2xl",
        {
          ["ml-2 h-2 w-2"]: size === "small",
          ["ml-4 h-4 w-4"]: size === "medium",
          ["bg-green-600"]: state === "active",
          ["bg-destructive"]: state === "closed"
        },
        className
      )}
    />
  );
};
