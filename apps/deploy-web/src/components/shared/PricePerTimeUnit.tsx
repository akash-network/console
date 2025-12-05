"use client";
import type { ReactNode } from "react";

import { averageDaysInMonth } from "@src/utils/dateUtils";
import { averageBlockTime } from "@src/utils/priceUtils";
import { PriceValue } from "./PriceValue";

interface IProps {
  perBlockValue: number;
  denom: string;
  className?: string;
  children?: ReactNode;
  showAsHourly?: boolean;
}

export const PricePerTimeUnit: React.FunctionComponent<IProps> = ({ perBlockValue, denom, className, showAsHourly = false, ...rest }) => {
  const hourlyValue = perBlockValue * (60 / averageBlockTime) * 60;
  const monthlyValue = hourlyValue * 24 * averageDaysInMonth;
  const value = showAsHourly ? hourlyValue : monthlyValue;
  const timeUnit = showAsHourly ? "hour" : "month";

  return (
    <span className={className} {...rest}>
      <strong>
        <PriceValue value={value} denom={denom} />
      </strong>{" "}
      / {timeUnit}
    </span>
  );
};
