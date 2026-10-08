import type { FC } from "react";

import { PriceValue } from "@src/components/shared/PriceValue";
import { getAvgCostPerMonth, perBlockToHourly } from "@src/utils/priceUtils";
import { useDeploymentHasGpu } from "../../DeploymentResourceSummary/useDeploymentResourceSummary";
import type { DeploymentCost } from "../../useDeploymentCost/useDeploymentCost";
import { formatCountdown } from "../../useQuoteExpiry/formatCountdown";
import type { QuoteExpiry } from "../../useQuoteExpiry/useQuoteExpiry";
import type { WorkspaceCtaState } from "../WorkspaceCtaButton/WorkspaceCtaButton";
import { WorkspaceCtaButton } from "../WorkspaceCtaButton/WorkspaceCtaButton";

export const DEPENDENCIES = { PriceValue, useDeploymentHasGpu };

type Props = {
  ctaState: WorkspaceCtaState;
  cost: DeploymentCost | null;
  expiry: QuoteExpiry | null;
  onDeploy: () => void;
  onRetry: () => void;
  onCloseAndEdit: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const DeploymentCostBar: FC<Props> = ({ ctaState, cost, expiry, onDeploy, onRetry, onCloseAndEdit, dependencies: d = DEPENDENCIES }) => {
  const showAsHourly = d.useDeploymentHasGpu();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Deployment cost</span>
        <span className="font-mono text-sm font-semibold">
          <BidCost cost={cost} showAsHourly={showAsHourly} PriceValue={d.PriceValue} />
        </span>
        {expiry && (
          <span className="text-xs text-muted-foreground">{expiry.isExpired ? "Bids expired" : `Bids expire in ${formatCountdown(expiry.secondsLeft)}`}</span>
        )}
      </div>
      <div className="grid sm:block">
        <WorkspaceCtaButton state={ctaState} onDeploy={onDeploy} onRetry={onRetry} onCloseAndEdit={onCloseAndEdit} />
      </div>
    </div>
  );
};

type BidCostProps = {
  cost: DeploymentCost | null;
  showAsHourly: boolean;
  PriceValue: typeof DEPENDENCIES.PriceValue;
};

/** Hourly for GPU deployments and monthly for CPU-only ones, like the marketplace, so a cheap spec never reads as `$0.00/hr`. */
function BidCost({ cost, showAsHourly, PriceValue }: BidCostProps) {
  if (!cost) return <>No open bids</>;

  const toDisplayValue = showAsHourly ? perBlockToHourly : getAvgCostPerMonth;

  return (
    <>
      <PriceValue denom={cost.denom} value={toDisplayValue(cost.minPerBlock)} />
      {cost.maxPerBlock !== cost.minPerBlock && (
        <>
          –<PriceValue denom={cost.denom} value={toDisplayValue(cost.maxPerBlock)} />
        </>
      )}
      <span className="font-normal text-muted-foreground">{showAsHourly ? "/hr" : "/month"}</span>
    </>
  );
}
