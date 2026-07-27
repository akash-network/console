"use client";
import type { ReactNode } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { averageDaysInMonth } from "@src/utils/dateUtils";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { averageBlockTime } from "@src/utils/priceUtils";
import { PriceValue } from "./PriceValue";

type Props = {
  value: number | string;
  denom: string;
  children?: ReactNode;
  showAsHourly?: boolean;
};

export const PriceEstimateTooltip: React.FunctionComponent<Props> = ({ value, denom, showAsHourly = false }) => {
  const denomValue = udenomToDenom(typeof value === "string" ? parseFloat(value) : value, 10);
  const perHourValue = denomValue * (60 / averageBlockTime) * 60;
  const perDayValue = perHourValue * 24;
  const perMonthValue = perHourValue * 24 * averageDaysInMonth;

  return (
    <CustomTooltip
      title={
        <div>
          <span className="text-sm text-muted-foreground">Price breakdown</span>

          {showAsHourly && (
            <div>
              <strong>
                <PriceValue value={perHourValue} denom={denom} />
              </strong>
              &nbsp; per hour
            </div>
          )}

          <div>
            <strong>
              <PriceValue value={perDayValue} denom={denom} />
            </strong>
            &nbsp; per day
          </div>

          <div>
            <strong>
              <PriceValue value={perMonthValue} denom={denom} />
            </strong>
            &nbsp; per month
          </div>
        </div>
      }
    >
      <InfoCircle className="ml-2 text-xs text-muted-foreground" />
    </CustomTooltip>
  );
};
