import type { FC } from "react";
import { useIntl } from "react-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { format, parseISO } from "date-fns";

import type { BucketStatus, DayBucket, ProviderUptime } from "./deriveProviderUptime";

/** Bar background color per bucket health level, matching the Figma uptime cell. */
const BAR_COLOR: Record<BucketStatus, string> = {
  online: "bg-emerald-500",
  partial: "bg-amber-500",
  offline: "bg-rose-500"
};

/** Bar height per bucket health level: 16 / 10 / 4 px. */
const BAR_HEIGHT: Record<BucketStatus, string> = {
  online: "h-4",
  partial: "h-2.5",
  offline: "h-1"
};

interface Props {
  uptime: ProviderUptime;
}

export const ProviderUptimeCell: FC<Props> = ({ uptime }) => {
  const intl = useIntl();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1">
          <span className={cn("w-[52px] whitespace-nowrap font-mono text-sm font-medium", percentColor(uptime.percent))}>
            {intl.formatNumber(uptime.percent, { style: "percent", maximumFractionDigits: 2 })}
          </span>
          <div className="flex h-4 items-end gap-px overflow-clip">
            {uptime.buckets.map(bucket => (
              <div
                key={bucket.date}
                data-testid="uptime-bar"
                className={cn("w-0.5", bucket.isLiveDown ? "h-4" : BAR_HEIGHT[bucket.status], BAR_COLOR[bucket.status])}
              />
            ))}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-0.5 text-muted-foreground">
          {uptime.buckets.map(bucket => (
            <span key={bucket.date}>{formatBucketTooltip(bucket)}</span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

/** Percentage text color tiers: healthy >= 99%, degraded >= 95%, else critical. */
function percentColor(percent: number): string {
  if (percent >= 0.99) return "text-emerald-500";
  if (percent >= 0.95) return "text-amber-500";
  return "text-rose-500";
}

/** Human summary of a day's health, one row per day in the cell tooltip. */
function formatBucketTooltip(bucket: DayBucket): string {
  const label = format(parseISO(bucket.date), "MMM d");
  const detail = [
    bucket.incidentCount > 0 ? `${bucket.incidentCount} incident${bucket.incidentCount === 1 ? "" : "s"}` : null,
    formatDowntime(bucket.downtimeSeconds)
  ]
    .filter(Boolean)
    .join(", ");

  if (bucket.isLiveDown) return detail ? `${label} — currently down (${detail})` : `${label} — currently down`;
  return detail ? `${label} — ${detail}` : `${label} — no incidents`;
}

/** Formats a downtime duration in seconds as a compact `Xh Ym` / `Xm` / `Xs` string, or null when zero. */
function formatDowntime(downtimeSeconds: number): string | null {
  if (downtimeSeconds === 0) return null;
  const hours = Math.floor(downtimeSeconds / 3600);
  const minutes = Math.floor((downtimeSeconds % 3600) / 60);
  if (hours && minutes) return `${hours}h ${minutes}m down`;
  if (hours) return `${hours}h down`;
  if (minutes) return `${minutes}m down`;
  return `${downtimeSeconds}s down`;
}
