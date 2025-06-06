"use client";

import { useMemo } from "react";

import { usePricing } from "@src/context/PricingProvider";
import type { FCWithFnChildren } from "@src/types/component";
import type { DeploymentDto } from "@src/types/deployment";
import { ceilDecimal, udenomToDenom } from "@src/utils/mathHelpers";

type Props = {
  deployment: DeploymentDto;
};

export const DeploymentBalanceContainer: FCWithFnChildren<Props, { balance: number }> = ({ deployment, children }) => {
  const { getPriceForDenom } = usePricing();
  const balance = useMemo(() => {
    const value = udenomToDenom(deployment.escrowBalance);
    const price = getPriceForDenom(deployment.denom);

    return ceilDecimal(value * price);
  }, [deployment.denom, deployment.escrowBalance, getPriceForDenom]);

  return <>{typeof children === "function" ? children({ balance }) : children}</>;
};
