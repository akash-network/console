"use client";
import type React from "react";
import { FormattedNumber } from "react-intl";

const USD_FORMAT = { style: "currency", currency: "USD" } as const satisfies Intl.NumberFormatOptions;

const USD_FORMATTER = new Intl.NumberFormat("en-US", USD_FORMAT);

const AMOUNT_PART_TYPES = new Set<Intl.NumberFormatPartTypes>(["minusSign", "integer", "decimal", "fraction"]);

/** Single source of the USD display format shared by the billing components, so the copies can't drift apart. */
export const UsdValue: React.FunctionComponent<{ value: number }> = ({ value }) => <FormattedNumber value={value} {...USD_FORMAT} />;

/** Rounds to the cents `UsdValue` shows, which is how the API rounds a balance too. */
export function roundUsdToCentPrecision(usd: number): number {
  const amountParts = USD_FORMATTER.formatToParts(usd).filter(({ type }) => AMOUNT_PART_TYPES.has(type));

  return Number(amountParts.map(({ value }) => value).join(""));
}
