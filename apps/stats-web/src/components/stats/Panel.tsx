import type { ReactNode } from "react";

import { formatDelta } from "@/lib/statsFormat/statsFormat";
import { cn } from "@/lib/utils";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("min-w-0 rounded-lg border bg-card text-card-foreground", className)}>{children}</section>;
}

export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("font-mono text-[11px] font-medium uppercase leading-none tracking-[0.1em] text-faint", className)}>{children}</span>;
}

export function PanelTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cn("whitespace-nowrap text-[15px] font-semibold leading-snug tracking-normal", className)}>{children}</h2>;
}

export function DeltaLabel({ percent, period, className }: { percent: number | undefined; period: string; className?: string }) {
  if (percent === undefined) {
    return null;
  }

  return (
    <span className={cn("font-mono text-[11px] font-medium leading-none", percent >= 0 ? "text-muted-foreground" : "text-akash", className)}>
      {formatDelta(percent, period)}
    </span>
  );
}

export function MeterBar({ percent, className, fillClassName = "bg-muted-foreground" }: { percent: number; className?: string; fillClassName?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full", fillClassName)} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="flex flex-col gap-2 px-5 py-4">
      <Eyebrow className="text-[10px]">{label}</Eyebrow>
      <span className="text-[22px] font-semibold tabular-nums leading-none tracking-[-0.02em]">{value}</span>
    </Panel>
  );
}
