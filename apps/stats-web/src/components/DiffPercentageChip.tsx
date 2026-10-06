"use client";
import React from "react";
import { FormattedNumber } from "react-intl";
import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

export interface DiffPercentageChipProps {
  value: number;
  className?: string;
  size?: "small" | "medium";
}

export const DiffPercentageChip: React.FunctionComponent<DiffPercentageChipProps> = ({ value, size = "small", className = "" }) => {
  if (typeof value !== "number") return null;

  const isPositiveDiff = value >= 0;

  return (
    <span
      className={cn(className, "flex items-center font-bold", {
        "text-red-400": !isPositiveDiff,
        "text-green-600": isPositiveDiff,
        "text-sm": size === "small",
        "text-base": size === "medium"
      })}
    >
      {isPositiveDiff ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      <span className="ml-1">
        <FormattedNumber style="percent" maximumFractionDigits={2} value={Math.abs(value)} />
      </span>
    </span>
  );
};
