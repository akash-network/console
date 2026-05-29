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
  const _value = udenomToDenom(typeof value === "string" ? parseFloat(value) : value, 10);
  const perHourValue = _value * (60 / averageBlockTime) * 60;
  const perDayValue = _value * (60 / averageBlockTime) * 60 * 24;
  const perMonthValue = _value * (60 / averageBlockTime) * 60 * 24 * averageDaysInMonth;

  return (
    <CustomTooltip
      title={
        <div>
          <span className="text-sm text-muted-foreground">Price estimation:</span>
          <div>
            <strong>
              <PriceValue value={_value} denom={denom} />
            </strong>
            &nbsp; per block (~{averageBlockTime}sec.)
          </div>

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
