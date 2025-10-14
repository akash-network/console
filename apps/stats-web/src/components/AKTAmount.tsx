"use client";
import React from "react";
import { FormattedNumber, FormattedNumberParts } from "react-intl";

import { AKTLabel } from "./AKTLabel";

import { usePricing } from "@/context/PricingProvider";
import { udenomToDenom } from "@/lib/mathHelpers";

type Props = {
  uakt: number | string;
  showAKTLabel?: boolean;
  showUSD?: boolean;
  digits?: number;
  notation?: "standard" | "scientific" | "engineering" | "compact" | undefined;
};

export const AKTAmount = ({ uakt, showUSD, showAKTLabel, digits = 6, notation }: React.PropsWithChildren<Props>) => {
  const { isLoaded: isPriceLoaded, aktToUSD } = usePricing();
  const aktAmount = udenomToDenom(uakt, 6);

  return (
    <>
      <FormattedNumberParts value={aktAmount} maximumFractionDigits={digits} minimumFractionDigits={digits} notation={notation}>
        {parts => (
          <>
            {parts.map((part, i) => {
              switch (part.type) {
                case "integer":
                case "group":
                  return <span key={i}>{part.value}</span>;

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
      </FormattedNumberParts>
      {showAKTLabel && <AKTLabel />}
      {isPriceLoaded && showUSD && aktAmount > 0 && (
        <small className="text-sm text-muted-foreground">
          &nbsp;(
          <FormattedNumber style="currency" currency="USD" value={aktToUSD(aktAmount)} notation="compact" />)
        </small>
      )}
    </>
  );
};
