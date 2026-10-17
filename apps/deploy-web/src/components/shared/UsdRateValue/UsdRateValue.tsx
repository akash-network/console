"use client";
import type { FC } from "react";
import { FormattedNumber } from "react-intl";

const ONE_CENT_USD = 0.01;
const SUB_CENT_SIGNIFICANT_DIGITS = 2;

export function isUnderACent(valueUsd: number): boolean {
  return valueUsd > 0 && valueUsd < ONE_CENT_USD;
}

/** Under a cent a rate keeps its significant digits, so a cheap deployment never reads as `$0.00/hr`. */
export const UsdRateValue: FC<{ value: number }> = ({ value }) => (
  <FormattedNumber value={value} style="currency" currency="USD" maximumSignificantDigits={isUnderACent(value) ? SUB_CENT_SIGNIFICANT_DIGITS : undefined} />
);
