"use client";
import React, { type ReactNode, useMemo, useState } from "react";
import { Card, CustomNoDivTooltip, Skeleton } from "@akashnetwork/ui/components";
import format from "date-fns/format";
import { InfoCircle, NavArrowDown, Wallet } from "iconoir-react";
import Link from "next/link";

import { UsdValue } from "@src/components/billing-usage/UsdValue/UsdValue";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { UrlService } from "@src/utils/urlUtils";
import { BalanceBreakdownBar, buildBalanceSegments } from "./BalanceBreakdownBar";
import { useAccountBalanceOverview } from "./useAccountBalanceOverview";

export const DEPENDENCIES = {
  useAccountBalanceOverview,
  Card,
  CustomNoDivTooltip,
  Skeleton,
  UsdValue,
  BalanceBreakdownBar,
  Wallet,
  InfoCircle,
  NavArrowDown,
  Link
};

/**
 * Hours of running cost each deployment's escrow is kept funded to, and the ceiling it never exceeds:
 * automatic funding tops a deployment up to this target rather than adding to what it already holds.
 * Mirrors the backend `AUTO_TOP_UP_TARGET_RUNWAY_IN_H`. Update if that target changes.
 */
const ESCROW_WINDOW_HOURS = 48;

const ESCROW_TOOLTIP =
  "Each running deployment has its own escrow account. This is what those accounts hold to keep your deployments online, so it can't be used to start new ones. Whatever a deployment doesn't use returns to your available balance when it closes.";

const CARD_CLASSES = "rounded-xl p-5 shadow-none sm:px-[22px]";

export const AccountBalanceOverview: React.FunctionComponent<{ footerAction?: ReactNode; dependencies?: typeof DEPENDENCIES }> = ({
  footerAction,
  dependencies: d = DEPENDENCIES
}) => {
  const overview = d.useAccountBalanceOverview();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const segments = useMemo(() => buildBalanceSegments(overview.deployments, overview.available), [overview.deployments, overview.available]);
  const usd = (value: number) => <d.UsdValue value={value} />;

  const header = (
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-sm font-normal tracking-normal text-muted-foreground">Account Balance</h3>
      <d.Wallet className="h-[17px] w-[17px] shrink-0 text-muted-foreground" aria-hidden />
    </div>
  );

  if (overview.isError) {
    return (
      <SettingsSection title="Account">
        <d.Card className={CARD_CLASSES}>
          {header}
          <p className="mt-3 text-sm text-muted-foreground">Your balance couldn't be loaded. It will refresh automatically once the connection recovers.</p>
          {footerAction && <div className="mt-4 border-t pt-3.5">{footerAction}</div>}
        </d.Card>
      </SettingsSection>
    );
  }

  if (overview.isLoading) {
    return (
      <SettingsSection title="Account">
        <d.Card className={CARD_CLASSES}>
          {header}
          <d.Skeleton className="mt-3 h-9 w-48" />
          <d.Skeleton className="mt-3.5 h-2.5 w-full" />
          <div className="mt-3.5 grid max-w-[720px] grid-cols-1 gap-4 sm:grid-cols-2">
            <d.Skeleton className="h-14 w-40" />
            <d.Skeleton className="h-14 w-40" />
          </div>
        </d.Card>
      </SettingsSection>
    );
  }

  const escrowSegments = segments.filter(segment => segment.key !== "available");
  const activeHoveredKey = hoveredKey && segments.some(segment => segment.key === hoveredKey) ? hoveredKey : null;
  const hasRunway = overview.runwayDays !== null && overview.lastsUntil !== null;

  return (
    <SettingsSection title="Account">
      <d.Card className={CARD_CLASSES}>
        {header}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[30px] font-bold tabular-nums leading-[1.1] tracking-tight" aria-label="Total account balance">
            {usd(overview.totalUsd)}
          </span>
          {hasRunway && (
            <span className="rounded-full bg-success/15 px-2.5 py-[3px] text-xs font-medium text-success">{`${overview.runwayDays} days of runway`}</span>
          )}
          {hasRunway && (
            <p className="w-full text-[13px] text-muted-foreground sm:ml-auto sm:w-auto">
              Spending {usd(overview.perHour)}/hr · lasts until{" "}
              <span className="font-semibold text-foreground">{format(overview.lastsUntil!, "MMM d, yyyy")}</span>
            </p>
          )}
        </div>

        <div className="mt-3.5">
          <d.BalanceBreakdownBar
            segments={segments}
            hoveredKey={activeHoveredKey}
            onHover={setHoveredKey}
            threshold={overview.autoReloadThreshold}
            hideThresholdCaption
          />
        </div>

        <div className="mt-3.5 grid max-w-[720px] grid-cols-1 gap-4 sm:grid-cols-2">
          <BalanceFigure
            label="Escrow"
            dot={<span className="h-[7px] w-[7px] shrink-0 rounded-full bg-foreground" aria-hidden />}
            info={
              <d.CustomNoDivTooltip title={ESCROW_TOOLTIP}>
                <span className="inline-flex cursor-help text-muted-foreground">
                  <d.InfoCircle className="h-[13px] w-[13px]" />
                </span>
              </d.CustomNoDivTooltip>
            }
            amount={
              <span className="text-foreground" aria-label="Escrow balance">
                {usd(overview.escrow)}
              </span>
            }
            caption={
              escrowSegments.length === 0
                ? "No deployments running"
                : `Held to keep your ${escrowSegments.length} deployment${escrowSegments.length === 1 ? "" : "s"} running`
            }
          />
          <BalanceFigure
            label="Available"
            dot={<span className="h-[7px] w-[7px] shrink-0 rounded-full bg-success" aria-hidden />}
            amount={
              <span className="text-success" aria-label="Available balance">
                {usd(overview.available)}
              </span>
            }
            caption={getAvailableCaption(overview.available, escrowSegments.length)}
          />
        </div>

        {(escrowSegments.length > 0 || footerAction) && (
          <div className="mt-4 space-y-3 border-t pt-3.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              {escrowSegments.length > 0 && (
                <button
                  type="button"
                  className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground"
                  onClick={() => setIsBreakdownOpen(open => !open)}
                  aria-expanded={isBreakdownOpen}
                >
                  <d.NavArrowDown className="h-3.5 w-3.5 transition-transform duration-150 group-aria-[expanded=false]:-rotate-90" aria-hidden />
                  {isBreakdownOpen ? "Hide breakdown" : "Show breakdown"}
                </button>
              )}
              {footerAction && <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">{footerAction}</div>}
            </div>
            {escrowSegments.length > 0 && isBreakdownOpen && (
              <>
                <ul className="flex flex-wrap gap-1.5">
                  {escrowSegments.map(segment => (
                    <li key={segment.key} className="max-w-full">
                      <d.Link
                        href={UrlService.deploymentDetails(segment.key)}
                        data-active={segment.key === activeHoveredKey || undefined}
                        className="inline-flex max-w-full items-center gap-2 rounded-full bg-muted px-3 py-[5px] text-xs text-foreground no-underline transition-colors data-[active]:bg-foreground/15 data-[active]:ring-1 data-[active]:ring-inset data-[active]:ring-foreground hover:no-underline"
                        onMouseEnter={() => setHoveredKey(segment.key)}
                        onMouseLeave={() => setHoveredKey(null)}
                        onFocus={() => setHoveredKey(segment.key)}
                        onBlur={() => setHoveredKey(null)}
                      >
                        <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-foreground" aria-hidden />
                        <span className="min-w-0 truncate font-semibold">{segment.label}</span>
                        {segment.perHourUsd !== undefined && (
                          <span className="whitespace-nowrap tabular-nums text-muted-foreground">{usd(segment.perHourUsd)}/hr</span>
                        )}
                        <span className="whitespace-nowrap font-semibold tabular-nums">{usd(segment.amountUsd)}</span>
                      </d.Link>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">{`Each running deployment keeps around ${ESCROW_WINDOW_HOURS} hours of its cost in escrow.`}</p>
              </>
            )}
          </div>
        )}
      </d.Card>
    </SettingsSection>
  );
};

function getAvailableCaption(available: number, runningDeploymentCount: number) {
  if (available > 0) return "Free to spend on something new";
  return runningDeploymentCount > 0 ? "Add to your balance to deploy something new" : "Add to your balance to start deploying";
}

const BalanceFigure: React.FunctionComponent<{ label: string; dot: ReactNode; info?: ReactNode; amount: ReactNode; caption: string }> = ({
  label,
  dot,
  info,
  amount,
  caption
}) => (
  <div className="flex min-w-0 flex-col gap-[3px]">
    <span className="inline-flex items-center gap-[7px] font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">
      {dot}
      {label}
      {info}
    </span>
    <span className="text-xl font-bold tabular-nums">{amount}</span>
    <span className="text-xs text-muted-foreground">{caption}</span>
  </div>
);
