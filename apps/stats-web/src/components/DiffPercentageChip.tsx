"use client";
import React from "react";

import { cn } from "@/lib/utils";

export interface DiffPercentageChipProps {
  value: number;
  className?: string;
}

export const DiffPercentageChip: React.FunctionComponent<DiffPercentageChipProps> = ({ value, className = "" }) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  const isPositiveDiff = value >= 0;

  return (
    <span className={cn("font-mono text-[11px] font-medium leading-none", isPositiveDiff ? "text-muted-foreground" : "text-akash", className)}>
      {isPositiveDiff ? "↗ +" : "↘ "}
      {(value * 100).toFixed(1)}% · 24H
    </span>
  );
};
