import React from "react";
import { FormattedNumber } from "react-intl";
import { ArrowUp, ArrowDown } from "lucide-react";
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
      className={cn(className, "flex items-center", {
        "text-red-400": !isPositiveDiff,
        "text-green-800": isPositiveDiff,
        "text-sm": size === "small",
        "text-base": size === "medium"
      })}
    >
      {isPositiveDiff ? <ArrowUp size="1rem" /> : <ArrowDown size="1rem" />}
      <FormattedNumber style="percent" maximumFractionDigits={2} value={Math.abs(value)} />
    </span>
  );
};
