"use client";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@akashnetwork/ui/components";
import { Flash, NavArrowDown } from "iconoir-react";
import Link from "next/link";

import { BalanceBreakdownBar } from "@src/components/billing-usage/AccountBalanceOverview/BalanceBreakdownBar";
import { UsdValue } from "@src/components/billing-usage/UsdValue/UsdValue";
import { UrlService } from "@src/utils/urlUtils";
import type { FundingImpact } from "./useFundingImpact";
import { useFundingImpact } from "./useFundingImpact";
import type { ReviewRow } from "./useReviewRows";

export const DEPENDENCIES = {
  useFundingImpact,
  BalanceBreakdownBar,
  UsdValue,
  Link
};

type Props = {
  rows: ReviewRow[];
  runtimeLimitHours: number | undefined;
  dependencies?: typeof DEPENDENCIES;
};

type VisibleImpact = Extract<FundingImpact, { kind: "visible" }>;

const STATE_BADGES: Partial<Record<VisibleImpact["state"], string>> = {
  "crosses-threshold": "Buys credits",
  "no-payment-method": "No payment method",
  "not-enough-available": "Not enough available"
};

/**
 * What confirming does to the account's money: the estimated reserve, the available balance it comes out
 * of, and whether it triggers an automatic credit purchase. Purely informative — it never blocks the
 * deploy, and it renders nothing at all when the estimate can't be made.
 */
export const FundingImpactReviewSection: FC<Props> = ({ rows, runtimeLimitHours, dependencies: d = DEPENDENCIES }) => {
  const impact = d.useFundingImpact({ rows, runtimeLimitHours });
  const [isExpanded, setIsExpanded] = useState(false);
  const usd = (value: number) => <d.UsdValue value={value} />;

  if (impact.kind === "hidden") return null;

  if (impact.kind === "unavailable") {
    return (
      <p className="text-xs text-muted-foreground">
        Balance details are unavailable right now.{" "}
        <d.Link href={UrlService.billing()} className="underline">
          Check Billing
        </d.Link>{" "}
        for what gets reserved.
      </p>
    );
  }

  const badge = STATE_BADGES[impact.state];
  const addCreditsButton = (
    <Button size="sm" asChild>
      <d.Link href={UrlService.billing({ openPayment: true })}>Add Credits</d.Link>
    </Button>
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="rounded-lg border p-4">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-4 text-left">
        <span className="text-sm">
          Reserved <span className="font-medium">~{usd(impact.reserveUsd)}</span>
          <span className="text-muted-foreground"> · available after </span>
          {impact.availableAfterUsd === null ? (
            <span className="text-destructive">—</span>
          ) : (
            <span className="font-medium text-success">{usd(impact.availableAfterUsd)}</span>
          )}
          {impact.runtimeCoveredHours !== null && <span className="text-muted-foreground"> · ≈{formatRuntime(impact.runtimeCoveredHours)} of runtime</span>}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {badge && (
            <span className="rounded border border-destructive/60 px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-destructive">{badge}</span>
          )}
          <NavArrowDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 pt-4">
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            <span className="text-muted-foreground">Reserved ~ {usd(impact.reserveUsd)} (estimate)</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span>
              <span className="font-medium">{usd(impact.availableNowUsd)}</span> <span className="text-muted-foreground">available now</span>
            </span>
          </span>
        </div>

        {impact.availableAfterUsd !== null && (
          <d.BalanceBreakdownBar
            segments={[
              { key: "reserve", label: "Reserved", amountUsd: impact.reserveUsd, color: "hsl(var(--muted-foreground) / 0.4)" },
              { key: "available", label: "Available", amountUsd: impact.availableAfterUsd, color: "hsl(var(--success))" }
            ]}
            threshold={impact.thresholdUsd}
            hideThresholdCaption
          />
        )}

        {renderStateDetails(impact, usd, addCreditsButton)}

        <p className="text-sm text-muted-foreground">
          The reserve is held, not charged. You pay for the time your deployment actually runs, and anything it doesn&apos;t use returns to available when the
          deployment closes.
        </p>

        <d.Link href={UrlService.billing()} className="inline-block text-sm text-success hover:underline">
          Full balance breakdown in Billing →
        </d.Link>
      </CollapsibleContent>
    </Collapsible>
  );
};

function renderStateDetails(impact: VisibleImpact, usd: (value: number) => ReactNode, addCreditsButton: ReactNode): ReactNode {
  switch (impact.state) {
    case "funded":
      return impact.thresholdUsd === null ? null : (
        <p className="text-sm text-muted-foreground">
          Auto Top-Up threshold <span className="font-medium text-foreground">{usd(impact.thresholdUsd)}</span> · available stays above it, so no credits are
          purchased.
        </p>
      );
    case "crosses-threshold":
      return (
        <Callout tone="warning">
          <Flash className="h-4 w-4 shrink-0" />
          <span>
            Confirming drops available to <span className="font-medium">{impact.availableAfterUsd === null ? "—" : usd(impact.availableAfterUsd)}</span>, below
            your Auto Top-Up threshold of <span className="font-medium">{impact.thresholdUsd === null ? "—" : usd(impact.thresholdUsd)}</span>.{" "}
            {impact.cardLabel ?? "Your default card"} is charged <span className="font-medium">{usd(impact.chargeUsd)}</span> for credits.
          </span>
        </Callout>
      );
    case "no-payment-method":
      return (
        <Callout tone="neutral">
          <span className="flex-1">No payment method on file, so nothing is charged automatically. Add credits to keep deployments funded.</span>
          {addCreditsButton}
        </Callout>
      );
    case "not-enough-available":
      return (
        <Callout tone="warning">
          <span className="flex-1">
            Your available balance of <span className="font-medium">{usd(impact.availableNowUsd)}</span> can&apos;t cover the estimated reserve of{" "}
            <span className="font-medium">~{usd(impact.reserveUsd)}</span>.
          </span>
          {addCreditsButton}
        </Callout>
      );
  }
}

const Callout: FC<{ tone: "warning" | "neutral"; children: ReactNode }> = ({ tone, children }) => (
  <div
    className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${tone === "warning" ? "border-destructive/50 bg-destructive/5" : "bg-muted/40"}`}
    role={tone === "warning" ? "alert" : undefined}
  >
    {children}
  </div>
);

function formatRuntime(hours: number): string {
  if (hours < 48) return `${Math.round(hours)} ${Math.round(hours) === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}
