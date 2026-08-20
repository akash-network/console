import type { FC } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { perBlockToHourly } from "@src/utils/priceUtils";
import { PriceValue } from "./PriceValue";

interface Props {
  perBlockValue: number;
  denom: string;
  gpuCount: number;
}

/**
 * Cost breakdown hung off a `CostRate`, which already shows the monthly rate (and the hourly rate for GPU
 * specs), so this only surfaces the rates that aren't already visible: the hourly rate for CPU-only specs, the
 * per-hour-per-GPU rate for GPU specs, and the daily rate.
 */
export const CostBreakdownTooltip: FC<Props> = ({ perBlockValue, denom, gpuCount }) => {
  const hourlyValue = perBlockToHourly(perBlockValue);
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
      <InfoCircle className="ml-2 text-xs text-muted-foreground" />
    </CustomTooltip>
  );
};
