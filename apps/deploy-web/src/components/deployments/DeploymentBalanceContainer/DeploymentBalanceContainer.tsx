"use client";

import { useCallback, useMemo } from "react";

import { usePricing } from "@src/context/PricingProvider";
import type { FCWithFnChildren } from "@src/types/component";
import type { DeploymentDto } from "@src/types/deployment";
import { ceilDecimal, udenomToDenom } from "@src/utils/mathHelpers";

type Props = {
  deployment: DeploymentDto;
};

type ChildrenProps = {
  balance: number;
  toDenom: (value: number) => number;
};

export const DeploymentBalanceContainer: FCWithFnChildren<Props, ChildrenProps> = ({ deployment, children }) => {
  const { getPriceForDenom, usdToAkt } = usePricing();
  const balance = useMemo(() => {
    const value = udenomToDenom(deployment.escrowBalance);
    const price = getPriceForDenom(deployment.denom);

    return ceilDecimal(value * price);
  }, [deployment.denom, deployment.escrowBalance, getPriceForDenom]);

  const toDenom: ChildrenProps["toDenom"] = useCallback(
    value => {
      if (deployment.denom !== "uakt") {
        return value;
      }

      const converted = usdToAkt(value);

      if (!converted) {
        throw new Error("Could not convert balance to AKT");
      }

      return converted;
    },
    [deployment.denom, usdToAkt]
  );

  return <>{typeof children === "function" ? children({ balance, toDenom }) : children}</>;
};
