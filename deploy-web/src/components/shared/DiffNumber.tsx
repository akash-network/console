import React from "react";
import { FormattedNumber } from "react-intl";
import { makeStyles } from "tss-react/mui";

export interface DiffNumberProps {
  value: number;
  unit?: string;
  className?: string;
}

const useStyles = makeStyles()(theme => ({}));

export const DiffNumber: React.FunctionComponent<DiffNumberProps> = ({ value, className = "", unit = "" }) => {
  if (typeof value !== "number") return null;

  const { classes } = useStyles();
  const isPositiveDiff = value >= 0;

  return (
    <span className={className}>
      {isPositiveDiff ? "+" : null}
      <FormattedNumber value={value} maximumFractionDigits={2} />
      {unit && ` ${unit}`}
    </span>
  );
};