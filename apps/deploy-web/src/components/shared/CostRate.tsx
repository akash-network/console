import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";

import { PRICE_DISPLAY_PRECISION, udenomToDenom } from "@src/utils/mathHelpers";
import { CostBreakdownTooltip } from "./CostBreakdownTooltip";
import { PricePerTimeUnit } from "./PricePerTimeUnit";

interface Props {
  /** Per-block price in udenom, straight off the chain — a bid price, or the summed price of live leases. */
  perBlockUDenom: number | string;
  denom: string;
  gpuCount: number;
  className?: string;
}

/**
 * A price at the time unit that reads best for the spec: a GPU spec headlines the hourly rate (digestible at
 * that scale) with the monthly rate beneath it; a CPU-only spec shows just the monthly rate so an inexpensive
 * deployment doesn't read as `$0.00/hr`. The info tooltip fills in the rates that aren't already shown.
 */
export const CostRate: FC<Props> = ({ perBlockUDenom, denom, gpuCount, className }) => {
  const showAsHourly = gpuCount > 0;
  const perBlockValue = udenomToDenom(perBlockUDenom, PRICE_DISPLAY_PRECISION);

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <span className="inline-flex items-center">
        <PricePerTimeUnit denom={denom} perBlockValue={perBlockValue} showAsHourly={showAsHourly} abbreviated />
        <CostBreakdownTooltip perBlockValue={perBlockValue} denom={denom} gpuCount={gpuCount} />
      </span>
      {showAsHourly && (
        <PricePerTimeUnit className="text-xs font-normal text-muted-foreground" denom={denom} perBlockValue={perBlockValue} showAsHourly={false} abbreviated />
      )}
    </div>
  );
};
