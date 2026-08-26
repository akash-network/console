import type { FC, ReactNode } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { PRICE_DISPLAY_PRECISION, udenomToDenom } from "@src/utils/mathHelpers";
import { perBlockToHourly } from "@src/utils/priceUtils";
import { PriceValue } from "./PriceValue";

interface Props {
  /** Per-block price in udenom, straight off the chain — a bid price, or the summed price of live leases. */
  perBlockUDenom: number | string;
  denom: string;
  gpuCount: number;
  children?: ReactNode;
}

/**
 * Cost breakdown hung off a cost figure that already shows the monthly rate (and the hourly rate for GPU
 * specs), so this only surfaces the rates that aren't already visible: the hourly rate for CPU-only specs, the
 * per-hour-per-GPU rate for GPU specs, and the daily rate. The trigger defaults to a small info icon and can be
 * overridden through `children`.
 */
export const CostBreakdownTooltip: FC<Props> = ({ perBlockUDenom, denom, gpuCount, children }) => {
  const hourlyValue = perBlockToHourly(udenomToDenom(perBlockUDenom, PRICE_DISPLAY_PRECISION));
  const dailyValue = hourlyValue * 24;
  const hasGpu = gpuCount > 0;
  const hourlyPerGpuValue = hasGpu ? hourlyValue / gpuCount : 0;

  return (
    <CustomTooltip
      title={
        <div>
          <span className="text-sm text-muted-foreground">Price breakdown</span>

          {hasGpu ? (
            <div>
              <strong>
                <PriceValue value={hourlyPerGpuValue} denom={denom} />
              </strong>
              &nbsp; per hour / GPU
            </div>
          ) : (
            <div>
              <strong>
                <PriceValue value={hourlyValue} denom={denom} />
              </strong>
              &nbsp; per hour
            </div>
          )}

          <div>
            <strong>
              <PriceValue value={dailyValue} denom={denom} />
            </strong>
            &nbsp; per day
          </div>
        </div>
      }
    >
      {children ?? <InfoCircle className="ml-2 text-xs text-muted-foreground" />}
    </CustomTooltip>
  );
};
