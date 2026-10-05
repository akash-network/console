import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";

export type RegionTone = "northAmerica" | "southAmerica" | "europe" | "asia" | "africa" | "oceania" | "other";

const REGION_PILL_CLASSES: Record<RegionTone, string> = {
  northAmerica: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  southAmerica: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
  europe: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  asia: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  africa: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  oceania: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  other: "bg-violet-500/15 text-violet-700 dark:text-violet-400"
};

export const REGION_DOT_CLASSES: Record<RegionTone, string> = {
  northAmerica: "bg-blue-500",
  southAmerica: "bg-pink-500",
  europe: "bg-emerald-500",
  asia: "bg-amber-500",
  africa: "bg-orange-500",
  oceania: "bg-teal-500",
  other: "bg-violet-500"
};

const REGION_TONE_PREFIXES: [RegionTone, string[]][] = [
  ["northAmerica", ["na-", "us-", "ca-", "northern-america", "central-america", "caribbean"]],
  ["southAmerica", ["sa-", "south-america"]],
  ["europe", ["eu-", "europe", "western-europe", "eastern-europe", "northern-europe", "southern-europe"]],
  ["asia", ["as-", "ap-", "in-", "asia", "south-eastern-asia", "eastern-asia", "southern-asia", "western-asia"]],
  ["africa", ["af-", "africa"]],
  ["oceania", ["oc-", "australia", "oceania"]]
];

export function getRegionTone(region: string): RegionTone {
  const normalized = region.toLowerCase();
  const match = REGION_TONE_PREFIXES.find(([, prefixes]) => prefixes.some(prefix => normalized.startsWith(prefix)));
  return match ? match[0] : "other";
}

export function formatRegionLabel(region: string): string {
  return region
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => (part.length <= 2 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

type Props = {
  region: string;
  className?: string;
};

export const RegionPill: FC<Props> = ({ region, className }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.04em]",
      REGION_PILL_CLASSES[getRegionTone(region)],
      className
    )}
  >
    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
    {formatRegionLabel(region)}
  </span>
);
