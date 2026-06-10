"use client";
import type { CSSProperties } from "react";
import { cn } from "@akashnetwork/ui/utils";

type Props = {
  state: "active" | "closed" | "reclaiming" | string;
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
          ["bg-amber-500"]: state === "reclaiming",
          ["bg-destructive"]: state === "closed"
        },
        className
      )}
    />
  );
};
