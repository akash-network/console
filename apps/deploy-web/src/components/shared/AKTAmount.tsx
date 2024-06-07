"use client";
import React from "react";
import { FormattedNumber, FormattedNumberParts } from "react-intl";

import { usePricing } from "@src/context/PricingProvider";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { AKTLabel } from "./AKTLabel";

type Props = {
  uakt: number;
  showAKTLabel?: boolean;
  showUSD?: boolean;
  digits?: number;
  notation?: "standard" | "scientific" | "engineering" | "compact" | undefined;
};

export const AKTAmount: React.FunctionComponent<Props> = ({ uakt, showUSD, showAKTLabel, digits = 6, notation }) => {
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
      </FormattedNumberParts>
      {showAKTLabel && <AKTLabel />}
      {isPriceLoaded && showUSD && aktAmount > 0 && (
        <small className="text-secondary-foreground">
          &nbsp;(
          <FormattedNumber style="currency" currency="USD" value={aktToUSD(aktAmount) || 0} notation="compact" />)
        </small>
      )}
    </>
  );
};
