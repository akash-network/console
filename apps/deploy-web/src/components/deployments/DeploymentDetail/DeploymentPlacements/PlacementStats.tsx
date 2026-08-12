import type { FC, ReactNode } from "react";

export interface PlacementStat {
  label: string;
  value: ReactNode;
}

export const PlacementStats: FC<{ stats: PlacementStat[] }> = ({ stats }) => (
  <div className="flex gap-6 sm:gap-10">
    {stats.map(stat => (
      <div key={stat.label} className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</span>
        <span className="whitespace-nowrap font-mono text-base font-medium">{stat.value}</span>
      </div>
    ))}
  </div>
);
