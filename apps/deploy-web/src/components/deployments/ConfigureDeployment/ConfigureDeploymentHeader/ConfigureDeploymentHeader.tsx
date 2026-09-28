import type { FC, ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button, CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Clock, LoaderCircle } from "lucide-react";

import { PriceValue } from "@src/components/shared/PriceValue";
import type { SdlBuilderFormValuesType } from "@src/types";
import { getAvgCostPerMonth, perBlockToHourly } from "@src/utils/priceUtils";
import type { DeployCtaState } from "../deployCtaState/deployCtaState";
import { deployCtaState } from "../deployCtaState/deployCtaState";
import { DeploymentResourceSummary } from "../DeploymentResourceSummary/DeploymentResourceSummary";
import { useDeploymentHasGpu } from "../DeploymentResourceSummary/useDeploymentResourceSummary";
import type { DeploymentCost } from "../useDeploymentCost/useDeploymentCost";
import { useDeploymentCost } from "../useDeploymentCost/useDeploymentCost";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import { formatCountdown } from "../useQuoteExpiry/formatCountdown";
import type { QuoteExpiry } from "../useQuoteExpiry/useQuoteExpiry";
import { useQuoteExpiry } from "../useQuoteExpiry/useQuoteExpiry";
import { useRequestQuotes } from "../useRequestQuotes/useRequestQuotes";
import { useRetryDeploy } from "../useRetryDeploy/useRetryDeploy";

export const DEPENDENCIES = {
  DeploymentResourceSummary,
  useDeploymentHasGpu,
  useRequestQuotes,
  useRetryDeploy,
  useDeploymentCost,
  PriceValue,
  useQuoteExpiry,
  CustomTooltip
};

type Props = {
  flow: DeploymentFlow;
  sdl: string;
  deploymentName: string;
  onDeploy: () => void;
  allPlacementsHaveBids: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const ConfigureDeploymentHeader: FC<Props> = ({ flow, sdl, deploymentName, onDeploy, allPlacementsHaveBids, dependencies: d = DEPENDENCIES }) => {
  const showAsHourly = d.useDeploymentHasGpu();
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const placements = useWatch({ control, name: "placements" });
  const cost = d.useDeploymentCost({ dseq: flow.dseq, sdl, placements, selections: flow.selections });
  const expiry = d.useQuoteExpiry({ dseq: flow.dseq, enabled: flow.phase === "quoting" });
  const requestQuotes = d.useRequestQuotes({ flow, deploymentName });
  const retryDeploy = d.useRetryDeploy({ flow });
  const ctaState = deployCtaState({
    phase: flow.phase,
    allPlacementsHaveBids,
    allPlacementsSelected: placements.length > 0 && placements.every(placement => !!flow.selections[placement.id]),
    hasDeployError: !!flow.deployError,
    quotesExpired: !!expiry?.isExpired,
    hasOpenBids: !!cost
  });

  return (
    <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex min-w-0 flex-col gap-1 md:gap-2 xl:flex-1">
        <h1 className="text-xl leading-tight md:text-3xl md:leading-9">Configure your deployment</h1>
        <p className="hidden text-base text-muted-foreground md:block">
          Adjust your deployment spec to refine available providers in the compute marketplace.
          <br />
          Request official quotes when you&apos;re ready.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 md:gap-6 xl:shrink-0 xl:justify-start">
        <div className="flex items-start gap-3 md:gap-6">
          <DeploymentSummaryBlock label="Your deployment" value={<d.DeploymentResourceSummary />} />
          <div className="hidden h-12 w-px self-stretch bg-border md:block" aria-hidden="true" />
          <div className="flex flex-col items-start gap-0.5 xl:items-end">
            <DeploymentSummaryBlock
              label="Deployment cost"
              value={<CostValue cost={cost} showAsHourly={showAsHourly} PriceValue={d.PriceValue} />}
              suffix={cost ? (showAsHourly ? "/hr" : "/month") : undefined}
            />
            <div className="h-4">{expiry ? <QuoteExpiryLine expiry={expiry} CustomTooltip={d.CustomTooltip} /> : null}</div>
          </div>
        </div>
        <HeaderCta state={ctaState} onRequestQuotes={requestQuotes} onCloseAndEdit={flow.actions.cancelAndEdit} onDeploy={onDeploy} onRetry={retryDeploy} />
      </div>
    </header>
  );
};

type HeaderCtaProps = {
  state: DeployCtaState;
  onRequestQuotes: () => void;
  onCloseAndEdit: () => void;
  onDeploy: () => void;
  onRetry: () => void;
};

function HeaderCta({ state, onRequestQuotes, onCloseAndEdit, onDeploy, onRetry }: HeaderCtaProps) {
  const className = "h-9 shrink-0 px-3 md:h-10 md:px-8";
  switch (state) {
    case "request-quotes":
      return (
        <Button type="button" onClick={onRequestQuotes} className={className}>
          Request quotes
        </Button>
      );
    case "close-and-edit":
      return (
        <Button type="button" onClick={onCloseAndEdit} className={className}>
          Close and Edit
        </Button>
      );
    case "deploy":
    case "select-providers":
      return (
        <Button type="button" disabled={state === "select-providers"} onClick={onDeploy} className={className}>
          Deploy
        </Button>
      );
    case "retry":
      return (
        <Button type="button" onClick={onRetry} className={className}>
          Retry
        </Button>
      );
    case "requesting":
      return (
        <Button type="button" disabled aria-label="Requesting" className={cn(className, "gap-2")}>
          <LoaderCircle className="h-4 w-4 animate-spin text-current" aria-hidden="true" />
          <span>Requesting…</span>
        </Button>
      );
  }
}

interface DeploymentSummaryBlockProps {
  label: string;
  value: ReactNode;
  suffix?: string;
}

function DeploymentSummaryBlock({ label, value, suffix }: DeploymentSummaryBlockProps) {
  return (
    <div className="flex flex-col items-start xl:items-end">
      <span className="font-mono text-[10px] uppercase text-muted-foreground md:text-sm">{label}</span>
      <div className="flex items-baseline gap-1">
        <div className="font-mono text-base font-semibold leading-tight md:text-xl md:leading-8">{value}</div>
        {suffix ? <span className="font-mono text-xs text-muted-foreground md:text-base">{suffix}</span> : null}
      </div>
    </div>
  );
}

interface CostValueProps {
  cost: DeploymentCost | null;
  showAsHourly: boolean;
  PriceValue: typeof DEPENDENCIES.PriceValue;
}

/**
 * The header cost value: a dash before bids, a single price when the bounds are equal, otherwise a min–max
 * range. Shown hourly for GPU deployments and monthly for CPU-only ones, matching the marketplace and review
 * modal so the same spec never reads as `$0.00/hr` in one place and `$30/month` in another.
 */
function CostValue({ cost, showAsHourly, PriceValue }: CostValueProps) {
  if (!cost) return <>—</>;
  const toDisplayValue = showAsHourly ? perBlockToHourly : getAvgCostPerMonth;
  if (cost.minPerBlock === cost.maxPerBlock) {
    return <PriceValue denom={cost.denom} value={toDisplayValue(cost.minPerBlock)} />;
  }
  return (
    <>
      <PriceValue denom={cost.denom} value={toDisplayValue(cost.minPerBlock)} /> - <PriceValue denom={cost.denom} value={toDisplayValue(cost.maxPerBlock)} />
    </>
  );
}

/**
 * The bid-expiry countdown shown under the cost: muted while counting, red in the final minute. Once the window
 * elapses it stays put, dropping the timer for a plain "expired" rather than showing 0:00. The `m:ss` sits in a
 * fixed-width, right-aligned slot with tabular figures so the ticking digits never reflow the label or icon. A
 * tooltip flags that the countdown is only indicative — bids can close a little earlier or later.
 */
function QuoteExpiryLine({ expiry, CustomTooltip }: { expiry: QuoteExpiry; CustomTooltip: typeof DEPENDENCIES.CustomTooltip }) {
  return (
    <CustomTooltip title="This countdown is only indicative — providers may close their bids a little earlier or later.">
      <div
        data-testid="quote-expiry"
        className={cn(
          "flex cursor-help items-center gap-1 font-mono text-[10px] md:text-xs",
          expiry.isExpired || expiry.secondsLeft < 60 ? "text-destructive" : "text-muted-foreground"
        )}
      >
        <Clock className="h-3 w-3" aria-hidden="true" />
        {expiry.isExpired ? (
          <span>expired</span>
        ) : (
          <span>
            expires in <span className="inline-block w-[4ch] text-right tabular-nums">{formatCountdown(expiry.secondsLeft)}</span>
          </span>
        )}
      </div>
    </CustomTooltip>
  );
}
