"use client";
import { ReactNode } from "react";
import { FormattedNumber } from "react-intl";
import { Spinner } from "@akashnetwork/ui/components";

import { usePricing } from "@src/context/PricingProvider";
import { ceilDecimal } from "@src/utils/mathHelpers";
import { cn } from "@akashnetwork/ui/utils";

type Props = {
  denom: string;
  value: string | number;
  showLt?: boolean;
  children?: ReactNode;
  className?: string;
};

export const PriceValue: React.FunctionComponent<Props> = ({ denom, value, showLt, className }) => {
  const { isLoaded, getPriceForDenom } = usePricing();
  const price = getPriceForDenom(denom);
  const _value = (typeof value === "string" ? parseFloat(value) : value) * price;
  const computedValue = _value > 0 ? ceilDecimal(_value) : 0;

  return (
    <span className={cn("inline-flex items-center", className)}>
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
