"use client";
import type { ReactNode } from "react";

import { averageDaysInMonth } from "@src/utils/dateUtils";
import { perBlockToHourly } from "@src/utils/priceUtils";
import { PriceValue } from "./PriceValue";

interface IProps {
  perBlockValue: number;
  denom: string;
  className?: string;
  children?: ReactNode;
  showAsHourly?: boolean;
  /** Render the unit abbreviated and tight ("$1.23/hr") instead of spelled out ("$1.23 / hour"). */
  abbreviated?: boolean;
}

export const PricePerTimeUnit: React.FunctionComponent<IProps> = ({ perBlockValue, denom, className, showAsHourly = false, abbreviated = false, ...rest }) => {
  const hourlyValue = perBlockToHourly(perBlockValue);
  const monthlyValue = hourlyValue * 24 * averageDaysInMonth;
  const value = showAsHourly ? hourlyValue : monthlyValue;
  const unitLabel = showAsHourly ? (abbreviated ? "hr" : "hour") : "month";

  return (
    <span className={className} {...rest}>
      <strong>
        <PriceValue value={value} denom={denom} />
      </strong>
      {abbreviated ? `/${unitLabel}` : ` / ${unitLabel}`}
    </span>
  );
};
