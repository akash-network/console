"use client";
import React from "react";
import { FormattedNumber, FormattedNumberParts } from "react-intl";

import { usePricing } from "@src/hooks/usePricing/usePricing";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { DenomLabel } from "../DenomLabel/DenomLabel";

export const DEPENDENCIES = {
  FormattedNumber,
  FormattedNumberParts,
  DenomLabel,
  usePricing
};

type Props = {
  amount: number;
  denom: string;
  showUSD?: boolean;
  digits?: number;
  notation?: "standard" | "scientific" | "engineering" | "compact";
  dependencies?: typeof DEPENDENCIES;
};

export function DenomAmount({ amount, denom, showUSD, digits = 6, notation, dependencies: d = DEPENDENCIES }: Props) {
  const { isLoaded: isPriceLoaded, udenomToUsd } = d.usePricing();
  const denomAmount = udenomToDenom(amount);

  return (
    <>
      <d.FormattedNumberParts value={denomAmount} maximumFractionDigits={digits} minimumFractionDigits={digits} notation={notation}>
        {parts => (
          <>
            {parts.map((part, i) => {
              switch (part.type) {
                case "integer":
                case "group":
                  return <b key={i}>{part.value}</b>;

                case "decimal":
                case "fraction":
                  return (
                    <small key={i} className="text-secondary-foreground">
                      {part.value}
                    </small>
                  );

                default:
                  return <React.Fragment key={i}>{part.value}</React.Fragment>;
              }
            })}
          </>
        )}
      </d.FormattedNumberParts>
      <d.DenomLabel denom={denom} />
      {isPriceLoaded && showUSD && denomAmount > 0 && (
        <small className="text-secondary-foreground">
          &nbsp;(
          <d.FormattedNumber style="currency" currency="USD" value={udenomToUsd(amount, denom) || 0} notation="compact" />)
        </small>
      )}
    </>
  );
}
