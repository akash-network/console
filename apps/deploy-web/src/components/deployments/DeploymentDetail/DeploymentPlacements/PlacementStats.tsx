import type { FC, ReactNode } from "react";
import { cn } from "@akashnetwork/ui/utils";

export interface PlacementStat {
  label: string;
  value: ReactNode;
}

export const PlacementStats: FC<{ stats: PlacementStat[]; variant?: "compact" | "spread" }> = ({ stats, variant = "compact" }) => (
  <div className={cn("flex flex-wrap", variant === "spread" ? "w-full gap-10" : "justify-start gap-8 lg:justify-end")}>
    {stats.map(stat => (
      <div key={stat.label} className={cn("flex min-w-0 flex-col gap-1", variant === "spread" && "flex-1")}>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</span>
        <span className="whitespace-nowrap text-base font-semibold">{stat.value}</span>
      </div>
    ))}
  </div>
);
