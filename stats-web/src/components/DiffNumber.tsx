import React from "react";
import { FormattedNumber } from "react-intl";

export interface DiffNumberProps {
  value: number;
  unit?: string;
  className?: string;
}

export const DiffNumber: React.FunctionComponent<DiffNumberProps> = ({ value, className = "", unit = "" }) => {
  if (typeof value !== "number") return null;

  const isPositiveDiff = value >= 0;

  return (
    <span className={className}>
      {isPositiveDiff ? "+" : null}
      <FormattedNumber value={value} maximumFractionDigits={2} />
      {unit && ` ${unit}`}
    </span>
  );
};
