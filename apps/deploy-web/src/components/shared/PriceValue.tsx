"use client";
import type { ReactNode } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { usePricing } from "@src/hooks/usePricing/usePricing";
import { ceilDecimal } from "@src/utils/mathHelpers";
import { isUnderACent, UsdRateValue } from "./UsdRateValue/UsdRateValue";

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
  const displayedValue = isUnderACent(_value) ? _value : computedValue;

  return (
    <span className={cn("inline-flex items-center", className)}>
      {!isLoaded && <Spinner size="small" />}
      {showLt && !!price && _value !== computedValue && "< "}
      {!!price && <UsdRateValue value={displayedValue} />}
    </span>
  );
};
