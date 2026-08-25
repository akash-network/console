"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CustomNoDivTooltip, Skeleton } from "@akashnetwork/ui/components";
import format from "date-fns/format";
import { InfoCircle, NavArrowDown, NavArrowRight, Wallet } from "iconoir-react";
import Link from "next/link";

import { UsdValue } from "@src/components/billing-usage/UsdValue/UsdValue";
import { UrlService } from "@src/utils/urlUtils";
import { BalanceBreakdownBar, buildBalanceSegments, ThresholdHatchSwatch } from "./BalanceBreakdownBar";
import { useAccountBalanceOverview } from "./useAccountBalanceOverview";

export const DEPENDENCIES = {
  useAccountBalanceOverview,
  Card,
  CardContent,
  CardHeader,
  CustomNoDivTooltip,
  Skeleton,
  UsdValue,
  BalanceBreakdownBar,
  Wallet,
  InfoCircle,
  NavArrowRight,
  NavArrowDown,
  Link
};

/**
 * Hours of running cost each deployment's escrow is kept funded to, and the ceiling it never exceeds:
 * automatic funding tops a deployment up to this target rather than adding to what it already holds.
 * Mirrors the backend `AUTO_TOP_UP_TARGET_RUNWAY_IN_H`. Update if that target changes.
 */
const RESERVE_WINDOW_HOURS = 48;

export const AccountBalanceOverview: React.FunctionComponent<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const overview = d.useAccountBalanceOverview();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const segments = useMemo(() => buildBalanceSegments(overview.deployments, overview.available), [overview.deployments, overview.available]);
  const usd = (value: number) => <d.UsdValue value={value} />;

  if (overview.isError) {
    return (
      <d.Card>
        <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <h3 className="text-lg font-bold leading-none">Account balance</h3>
          <d.Wallet className="h-4 w-4 text-muted-foreground" />
        </d.CardHeader>
        <d.CardContent>
          <p className="text-sm text-muted-foreground">Your balance couldn't be loaded. It will refresh automatically once the connection recovers.</p>
        </d.CardContent>
      </d.Card>
    );
  }

  if (overview.isLoading) {
    return (
      <d.Card>
        <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <d.Skeleton className="h-4 w-28" />
          <d.Skeleton className="h-4 w-4" />
        </d.CardHeader>
        <d.CardContent className="space-y-4">
          <d.Skeleton className="h-9 w-48" />
          <d.Skeleton className="h-3 w-full" />
          <d.Skeleton className="h-4 w-80" />
        </d.CardContent>
      </d.Card>
    );
  }

  const reservedSegments = segments.filter(segment => segment.key !== "available");
  const activeHoveredKey = hoveredKey && segments.some(segment => segment.key === hoveredKey) ? hoveredKey : null;
  const hasRunway = overview.runwayDays !== null && overview.lastsUntil !== null;

  return (
    <d.Card>
      <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <h3 className="text-lg font-bold leading-none">Account balance</h3>
        <d.Wallet className="h-4 w-4 text-muted-foreground" />
      </d.CardHeader>
      <d.CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-bold leading-none" aria-label="Total account balance">
              {usd(overview.totalUsd)}
            </span>
            {hasRunway && (
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">{`${overview.runwayDays} days of runway`}</span>
            )}
          </div>
          {hasRunway && (
            <p className="text-sm text-muted-foreground">
              Spending {usd(overview.perHour)}/hr · lasts until{" "}
              <span className="font-medium text-foreground">{format(overview.lastsUntil!, "MMM d, yyyy")}</span>
            </p>
          )}
        </div>

        <d.BalanceBreakdownBar segments={segments} hoveredKey={activeHoveredKey} onHover={setHoveredKey} threshold={overview.autoReloadThreshold} />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "hsl(var(--primary))" }} aria-hidden />
              <span>Reserved</span>
              <d.CustomNoDivTooltip title="Each running deployment is funded by its own escrow. The reserved amount is what those escrows currently hold to keep your deployments online, so it can't be used to start new ones. Whatever a deployment doesn't use returns to your available balance when it closes.">
                <span className="inline-flex cursor-pointer text-muted-foreground">
                  <d.InfoCircle className="h-3.5 w-3.5" />
                </span>
              </d.CustomNoDivTooltip>
            </div>
            <div className="text-2xl font-bold leading-none" aria-label="Reserved balance">
              {usd(overview.reserved)}
            </div>
            <p className="text-sm text-muted-foreground">
              {`Held to keep your ${reservedSegments.length} deployment${reservedSegments.length === 1 ? "" : "s"} running`}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "hsl(var(--success))" }} aria-hidden />
              <span>Available</span>
            </div>
            <div className="text-2xl font-bold leading-none text-success" aria-label="Available balance">
              {usd(overview.available)}
            </div>
            <p className="text-sm text-muted-foreground">Free to spend on something new</p>
          </div>
        </div>

        {overview.autoReloadThreshold != null && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-0 shrink-0 border-l-2 border-dashed border-foreground" aria-hidden />
              <span>
                Tops up at <span className="font-medium text-foreground">{usd(overview.autoReloadThreshold)}</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <ThresholdHatchSwatch />
              <span>Top-up buffer</span>
            </span>
          </div>
        )}

        {reservedSegments.length > 0 && (
          <div className="border-t pt-4">
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-foreground"
              onClick={() => setIsBreakdownOpen(open => !open)}
              aria-expanded={isBreakdownOpen}
            >
              {isBreakdownOpen ? <d.NavArrowDown className="h-4 w-4" /> : <d.NavArrowRight className="h-4 w-4" />}
              {isBreakdownOpen ? "Hide breakdown" : `What is reserved (${reservedSegments.length})`}
            </button>
            {isBreakdownOpen && (
              <div className="mt-3 space-y-3">
                <ul className="flex flex-wrap gap-2">
                  {reservedSegments.map(segment => (
                    <li
                      key={segment.key}
                      className="transition-opacity duration-150"
                      style={{ opacity: activeHoveredKey && activeHoveredKey !== segment.key ? 0.4 : 1 }}
                      onMouseEnter={() => setHoveredKey(segment.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                    >
                      <d.Link
                        href={UrlService.deploymentDetails(segment.key)}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm"
                        style={{ backgroundColor: segment.badgeBackground, color: segment.badgeColor }}
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden />
                        <span className="font-medium">{segment.label}</span>
                        {segment.perHourUsd !== undefined && <span className="opacity-70">{usd(segment.perHourUsd)}/hr</span>}
                        <span className="font-semibold">{usd(segment.amountUsd)}</span>
                      </d.Link>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">{`Each running deployment keeps around ${RESERVE_WINDOW_HOURS} hours of its cost in reserve.`}</p>
              </div>
            )}
          </div>
        )}

        {overview.autoReloadThreshold == null && overview.autoReloadEnabled && (
          <p className="text-sm text-success">Automatic top-ups are on. Your deployments stay funded.</p>
        )}
      </d.CardContent>
    </d.Card>
  );
};
