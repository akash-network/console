import { useCallback, useMemo } from "react";
import { ExactDeploymentAllowance, FeeAllowance } from "@akashnetwork/http-sdk";
import { isFuture } from "date-fns";
import invokeMap from "lodash/invokeMap";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useWallet } from "@src/context/WalletProvider";
import { useExactDeploymentGrantsQuery } from "@src/queries/useExactDeploymentGrantsQuery";
import { useExactFeeAllowanceQuery } from "@src/queries/useExactFeeAllowanceQuery";

export const useAutoTopUpLimits = () => {
  const { address } = useWallet();
  const uaktFeeAllowance = useExactFeeAllowanceQuery(address, browserEnvConfig.NEXT_PUBLIC_UAKT_TOP_UP_MASTER_WALLET_ADDRESS, { enabled: false });
  const uaktDeploymentGrant = useExactDeploymentGrantsQuery(address, browserEnvConfig.NEXT_PUBLIC_UAKT_TOP_UP_MASTER_WALLET_ADDRESS, { enabled: false });
  const usdcFeeAllowance = useExactFeeAllowanceQuery(address, browserEnvConfig.NEXT_PUBLIC_USDC_TOP_UP_MASTER_WALLET_ADDRESS, { enabled: false });
  const usdcDeploymentGrant = useExactDeploymentGrantsQuery(address, browserEnvConfig.NEXT_PUBLIC_USDC_TOP_UP_MASTER_WALLET_ADDRESS, { enabled: false });
  const uaktFeeLimit = useMemo(() => extractFeeLimit(uaktFeeAllowance.data), [uaktFeeAllowance.data]);
  const usdcFeeLimit = useMemo(() => extractFeeLimit(usdcFeeAllowance.data), [usdcFeeAllowance.data]);
  const uaktDeploymentLimit = useMemo(() => extractDeploymentLimit(uaktDeploymentGrant.data), [uaktDeploymentGrant.data]);
  const usdcDeploymentLimit = useMemo(() => extractDeploymentLimit(usdcDeploymentGrant.data), [usdcDeploymentGrant.data]);

  const earliestExpiration = useMemo(() => {
    const expirations = [
      uaktFeeAllowance.data?.allowance.expiration,
      uaktDeploymentGrant.data?.expiration,
      usdcFeeAllowance.data?.allowance.expiration,
      usdcDeploymentGrant.data?.expiration
    ]
      .filter(Boolean)
      .map(expiration => new Date(expiration!));

    if (!expirations.length) {
      return undefined;
    }

    return expirations.reduce((acc, date) => {
      if (date < acc) {
        return date;
      }

      return acc;
    });
  }, [
    uaktDeploymentGrant.data?.expiration,
    uaktFeeAllowance.data?.allowance.expiration,
    usdcDeploymentGrant.data?.expiration,
    usdcFeeAllowance.data?.allowance.expiration
  ]);

  const fetch = useCallback(
    async () => await Promise.all([invokeMap([uaktFeeAllowance, uaktDeploymentGrant, usdcFeeAllowance, usdcDeploymentGrant], "refetch")]),
    [uaktFeeAllowance, uaktDeploymentGrant, usdcFeeAllowance, usdcDeploymentGrant]
  );

  return {
    fetch,
    uaktFeeLimit,
    usdcFeeLimit,
    uaktDeploymentLimit,
    usdcDeploymentLimit,
    expiration: earliestExpiration
  };
};

function extractDeploymentLimit(deploymentGrant?: ExactDeploymentAllowance) {
  if (!deploymentGrant) {
    return undefined;
  }

  const isExpired = !isFuture(new Date(deploymentGrant.expiration));

  if (isExpired) {
    return undefined;
  }

  return parseFloat(deploymentGrant?.authorization.spend_limit.amount);
}

function extractFeeLimit(feeLimit?: FeeAllowance) {
  if (!feeLimit) {
    return undefined;
  }

  const isExpired = !isFuture(new Date(feeLimit.allowance.expiration));

  if (isExpired) {
    return undefined;
  }

  return parseFloat(feeLimit.allowance.spend_limit[0].amount);
}
