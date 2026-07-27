import type { FC } from "react";

import { PricePerTimeUnit } from "@src/components/shared/PricePerTimeUnit";
import { PRICE_DISPLAY_PRECISION, udenomToDenom } from "@src/utils/mathHelpers";
import { MarketplaceCostTooltip } from "./MarketplaceCostTooltip";

interface Props {
  price: { amount: string; denom: string };
  gpuCount: number;
}

/**
 * Cost column: a GPU spec headlines the hourly rate (digestible at that scale) with the monthly rate beneath it;
 * a CPU-only spec shows just the monthly rate so an inexpensive deployment doesn't read as `$0.00/hr`. The info
 * tooltip fills in the rates that aren't already shown (hourly for CPU, per-hour-per-GPU for GPU, plus daily).
 */
export const MarketplaceCostCell: FC<Props> = ({ price, gpuCount }) => {
  const showAsHourly = gpuCount > 0;
  const perBlockValue = udenomToDenom(price.amount, PRICE_DISPLAY_PRECISION);

  return (
    <div className="flex min-w-0 flex-col">
      <span className="inline-flex items-center">
        <PricePerTimeUnit denom={price.denom} perBlockValue={perBlockValue} showAsHourly={showAsHourly} abbreviated />
        <MarketplaceCostTooltip perBlockValue={perBlockValue} denom={price.denom} gpuCount={gpuCount} />
      </span>
      {showAsHourly && (
        <PricePerTimeUnit
          className="text-xs font-normal text-muted-foreground"
          denom={price.denom}
          perBlockValue={perBlockValue}
          showAsHourly={false}
          abbreviated
        />
      )}
    </div>
  );
};
