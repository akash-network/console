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
}

export const PricePerMonth: React.FunctionComponent<IProps> = ({ perBlockValue, denom, className, ...rest }) => {
  const value = perBlockValue * (60 / averageBlockTime) * 60 * 24 * averageDaysInMonth;
  return (
    <span className={className} {...rest}>
      <strong>
        <PriceValue value={value} denom={denom} />
      </strong>{" "}
      / month
    </span>
  );
};
