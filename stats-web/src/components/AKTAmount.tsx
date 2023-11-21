import { FormattedNumber, FormattedNumberParts } from "react-intl";
import React from "react";
import { AKTLabel } from "./AKTLabel";
import { usePricing } from "@/context/PricingProvider";
import { udenomToDenom } from "@/lib/mathHelpers";

type Props = {
  uakt: number;
  showAKTLabel?: boolean;
  showUSD?: boolean;
};

export const AKTAmount: React.FunctionComponent<Props> = ({ uakt, showUSD, showAKTLabel }) => {
  const { isLoaded: isPriceLoaded, aktToUSD } = usePricing();
  const aktAmount = udenomToDenom(uakt, 6);

  return (
    <>
      <FormattedNumberParts value={aktAmount} maximumFractionDigits={6} minimumFractionDigits={6}>
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
      {showAKTLabel && (
        <>
          &nbsp;
          <AKTLabel />
        </>
      )}
      {isPriceLoaded && showUSD && aktAmount > 0 && (
        <small className="text-secondary-foreground">
          &nbsp;(
          <FormattedNumber style="currency" currency="USD" value={aktToUSD(aktAmount)} />)
        </small>
      )}
    </>
  );
};
