"use client";
import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";

type StatusTone = "running" | "pending" | "closed";

const STATUS_LABELS: Record<string, string> = {
  active: "Running",
  reclaiming: "Reclaiming",
  closed: "Closed"
};

const STATUS_TONES: Record<string, StatusTone> = {
  active: "running",
  reclaiming: "pending",
  closed: "closed"
};

const BADGE_TONE_CLASS: Record<StatusTone, string> = {
  running: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  closed: "bg-destructive/10 text-destructive"
};

const DOT_TONE_CLASS: Record<StatusTone, string> = {
  running: "bg-emerald-500",
  pending: "bg-amber-500",
  closed: "bg-destructive"
};

export interface DeploymentStatusBadgeProps {
  state: string;
  className?: string;
}

export const DeploymentStatusBadge: FC<DeploymentStatusBadgeProps> = ({ state, className }) => {
  const tone = STATUS_TONES[state] ?? "pending";
  const label = STATUS_LABELS[state] ?? state;

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium", BADGE_TONE_CLASS[tone], className)}>
      <span className="relative flex h-2 w-2">
        {tone === "running" && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", DOT_TONE_CLASS[tone])} />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", DOT_TONE_CLASS[tone])} />
      </span>
      {label}
    </span>
  );
};
