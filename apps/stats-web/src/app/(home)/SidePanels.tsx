"use client";
import type { ReactNode } from "react";

import { microToUnit } from "./dashboardModel";

import { Link } from "@/components/Link/Link";
import { DeltaLabel, Eyebrow, MeterBar, Panel } from "@/components/stats/Panel";
import { Sparkline } from "@/components/stats/Sparkline";
import type { SeriesPoint } from "@/lib/series/series";
import { deltaPercent, sliceRange } from "@/lib/series/series";
import { formatBytes, formatCompact, formatNumber, formatUsd } from "@/lib/statsFormat/statsFormat";
import { UrlService } from "@/lib/urlUtils";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/types";
import { ProviderSnapshotsUrlParam, SnapshotsUrlParam } from "@/types";

export function SpendPanel({ dashboardData, totalUsdSeries }: { dashboardData: DashboardData | undefined; totalUsdSeries: SeriesPoint[] | undefined }) {
  const now = dashboardData?.now;

  return (
    <Panel className="flex flex-col gap-3.5 px-[22px] py-5">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Spent · All-time</Eyebrow>
        {totalUsdSeries && <DeltaLabel className="text-xs" percent={deltaPercent(totalUsdSeries, 30)} period="30D" />}
      </div>
      <div className="flex items-end justify-between gap-3">
        <Link href={UrlService.graph(SnapshotsUrlParam.totalUSDSpent)} className="text-foreground hover:text-foreground hover:no-underline">
          <span className="text-[32px] font-semibold tabular-nums leading-none tracking-[-0.025em]">
            {formatUsd(now && microToUnit(now.totalUUsdSpent), { compact: true })}
          </span>
        </Link>
        <Sparkline series={totalUsdSeries && sliceRange(totalUsdSeries, 30)} width={110} height={30} />
      </div>
      <div className="flex flex-col border-t border-muted">
        <SideRow
          label="AKT spent"
          href={UrlService.graph(SnapshotsUrlParam.totalAKTSpent)}
          value={`${formatCompact(now && microToUnit(now.totalUAktSpent))} AKT`}
        />
        <SideRow
          label="ACT spent"
          href={UrlService.graph(SnapshotsUrlParam.totalACTSpent)}
          value={`${formatCompact(now && microToUnit(now.totalUActSpent))} ACT`}
          isLast
        />
      </div>
    </Panel>
  );
}

export function NetworkNowPanel({ dashboardData }: { dashboardData: DashboardData | undefined }) {
  const now = dashboardData?.now;
  const capacity = dashboardData?.networkCapacity;

  return (
    <Panel className="flex flex-1 flex-col px-[22px] py-5">
      <Eyebrow className="pb-1.5">The network, right now</Eyebrow>
      <SideRow label="Active providers" href={UrlService.providerGraph(ProviderSnapshotsUrlParam.count)} value={formatNumber(capacity?.activeProviderCount)} />
      <SideRow label="CPU leased" href={UrlService.graph(SnapshotsUrlParam.compute)} value={`${formatCompact(now && now.activeCPU / 1000)} vCPU`} />
      <SideRow label="Memory leased" href={UrlService.graph(SnapshotsUrlParam.memory)} value={formatBytes(now?.activeMemory)} />
      <SideRow label="Storage leased" href={UrlService.graph(SnapshotsUrlParam.storage)} value={formatBytes(now?.activeStorage)} />
      <SideRow
        label="AKT spent · 24h"
        href={UrlService.graph(SnapshotsUrlParam.dailyAktSpent)}
        value={`${formatCompact(now && microToUnit(now.dailyUAktSpent))} AKT`}
        muted
      />
      <SideRow
        label="ACT spent · 24h"
        href={UrlService.graph(SnapshotsUrlParam.dailyActSpent)}
        value={`${formatCompact(now && microToUnit(now.dailyUActSpent))} ACT`}
        muted
      />
      <div className="mt-auto flex flex-col gap-[7px] pt-3">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">GPUs leased</span>
          <span className="font-mono font-medium">
            {formatNumber(capacity?.activeGPU)} / {formatNumber(capacity?.totalGPU)}
          </span>
        </div>
        <MeterBar percent={capacity?.totalGPU ? (capacity.activeGPU / capacity.totalGPU) * 100 : 0} className="h-[5px]" />
      </div>
    </Panel>
  );
}

export function SideRow({ label, value, href, muted, isLast }: { label: string; value: ReactNode; href?: string; muted?: boolean; isLast?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2.5", !isLast && "border-b border-muted")}>
      {href ? (
        <Link href={href} className="text-xs text-muted-foreground hover:text-akash hover:no-underline">
          {label}
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
      <span className={cn("whitespace-nowrap font-mono text-xs font-medium", muted ? "text-muted-foreground" : "text-foreground")}>{value}</span>
    </div>
  );
}
