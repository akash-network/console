"use client";
import { FormattedNumber } from "react-intl";
import { ReactNode } from "react";
import Spinner from "./Spinner";
import { usePricing } from "@src/context/PricingProvider";
import { ceilDecimal } from "@src/utils/mathHelpers";

type Props = {
  denom: string;
  value: string | number;
  showLt?: boolean;
  children?: ReactNode;
};

export const PriceValue: React.FunctionComponent<Props> = ({ denom, value, showLt }) => {
  const { isLoaded, getPriceForDenom } = usePricing();
  const price = getPriceForDenom(denom);
  const _value = (typeof value === "string" ? parseFloat(value) : value) * price;
  const computedValue = _value > 0 ? ceilDecimal(_value) : 0;

  return (
    <span className="inline-flex items-center">
      {!isLoaded && <Spinner size="small" />}
      {showLt && !!price && _value !== computedValue && "< "}
      {!!price && (
        <FormattedNumber
          value={computedValue}
          // eslint-disable-next-line react/style-prop-object
          style="currency"
          currency="USD"
        />
      )}
    </span>
  );
};
