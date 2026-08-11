"use client";
import React from "react";
import { FormattedNumber } from "react-intl";
import { Card, CardContent, CardHeader, CustomTooltip, Skeleton } from "@akashnetwork/ui/components";
import format from "date-fns/format";
import { InfoCircle, Wallet } from "iconoir-react";

import { BalanceBreakdownBar, buildBalanceSegments } from "./BalanceBreakdownBar";
import { useAccountBalanceOverview } from "./useAccountBalanceOverview";

export const DEPENDENCIES = {
  useAccountBalanceOverview,
  Card,
  CardContent,
  CardHeader,
  CustomTooltip,
  Skeleton,
  FormattedNumber,
  BalanceBreakdownBar,
  Wallet,
  InfoCircle
};

export const AccountBalanceOverview: React.FunctionComponent<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const overview = d.useAccountBalanceOverview();
  const usd = (value: number) => <d.FormattedNumber value={value} style="currency" currency="USD" />;

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

  const segments = buildBalanceSegments(overview.deployments, overview.available);
  const hasRunway = overview.runwayDays !== null && overview.lastsUntil !== null;

  return (
    <d.Card>
      <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <h3 className="text-sm font-medium leading-none text-muted-foreground">Account balance</h3>
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
            <span className="text-sm text-success">
              {usd(overview.available)}
              {" available"}
            </span>
          </div>
          {hasRunway && (
            <p className="text-sm text-muted-foreground">
              Spending {usd(overview.perHour)}/hr · lasts until <span className="font-medium text-foreground">{format(overview.lastsUntil!, "MMM d")}</span>
            </p>
          )}
        </div>

        <d.BalanceBreakdownBar segments={segments} />

        {segments.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">
            {segments.map(segment => (
              <li key={segment.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden />
                  <span className="truncate text-muted-foreground">{segment.label}</span>
                </span>
                <span className="shrink-0 font-medium">{usd(segment.amountUsd)}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm text-muted-foreground">
          {overview.reserved > 0 && (
            <>
              <span className="font-medium text-foreground">{usd(overview.reserved)}</span>
              {` is reserved to keep your ${overview.activeDeploymentCount} running deployment${overview.activeDeploymentCount === 1 ? "" : "s"} online. `}
            </>
          )}
          <span className="font-medium text-foreground">{usd(overview.available)}</span>
          {" is available for new deployments."}
          <d.CustomTooltip title="Reserved funds return to Available when a deployment closes.">
            <d.InfoCircle className="ml-1 inline h-3.5 w-3.5 cursor-pointer align-text-bottom text-muted-foreground" />
          </d.CustomTooltip>
        </p>

        {overview.autoReloadEnabled && <p className="text-sm text-success">Auto Recharge is on — your deployments stay funded.</p>}
      </d.CardContent>
    </d.Card>
  );
};
