import { useCallback, useEffect, useState } from "react";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useChainParam } from "@src/context/ChainParamProvider";
import { usePricing } from "@src/context/PricingProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useBalances } from "@src/queries/useBalancesQuery";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { useUsdcDenom } from "./useDenom";

export const TX_FEE_BUFFER = 10000;

export type WalletBalance = {
  totalUsd: number;
  balanceUAKT: number;
  balanceUUSDC: number;
  totalUAKT: number;
  totalUUSDC: number;
  totalDeploymentEscrowUAKT: number;
  totalDeploymentEscrowUUSDC: number;
  totalDeploymentEscrowUSD: number;
  totalDeploymentGrantsUAKT: number;
  totalDeploymentGrantsUUSDC: number;
  totalDeploymentGrantsUSD: number;
};

export type WalletBalanceReturnType = {
  isLoading: boolean;
  refetch: () => void;
  balance: WalletBalance | null;
};

export const useWalletBalance = (): WalletBalanceReturnType => {
  const { isLoaded, price } = usePricing();
  const { address, isManaged } = useWallet();
  const usdcIbcDenom = useUsdcDenom();
  const { data: balances, isFetching: isLoadingBalances, refetch } = useBalances(address);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);

  const udenomToUsd = useCallback(
    (amount: string, denom: string) => {
      let value = 0;

      if (denom === UAKT_DENOM) {
        value = uaktToAKT(parseFloat(amount), 6) * (price || 0);
      } else if (denom === usdcIbcDenom) {
        value = udenomToDenom(parseFloat(amount), 6);
      }

      return value;
    },
    [price, usdcIbcDenom]
  );

  useEffect(() => {
    if (isLoaded && balances && price) {
      const aktUsdValue = uaktToAKT(balances.balanceUAKT, 6) * price;
      const totalUsdcValue = udenomToDenom(balances.balanceUUSDC, 6);
      const totalDeploymentEscrowUSD = balances.activeDeployments.reduce(
        (acc, d) =>
          acc +
          udenomToUsd(d.escrowAccount.funds.amount, d.escrowAccount.funds.denom) +
          udenomToUsd(d.escrowAccount.balance.amount, d.escrowAccount.balance.denom),
        0
      );
      const { deploymentGrant } = balances;
      const totalDeploymentGrantsUSD = deploymentGrant
        ? udenomToUsd(deploymentGrant.authorization.spend_limit.amount, deploymentGrant.authorization.spend_limit.denom)
        : 0;

      setWalletBalance({
        totalUsd: aktUsdValue + totalUsdcValue + totalDeploymentEscrowUSD + totalDeploymentGrantsUSD,
        balanceUAKT: balances.balanceUAKT + balances.deploymentGrantsUAKT,
        balanceUUSDC: balances.balanceUUSDC + balances.deploymentGrantsUUSDC,
        totalUAKT: balances.balanceUAKT + balances.deploymentEscrowUAKT + balances.deploymentGrantsUAKT,
        totalUUSDC: balances.balanceUUSDC + balances.deploymentEscrowUUSDC + balances.deploymentGrantsUUSDC,
        totalDeploymentEscrowUAKT: balances.deploymentEscrowUAKT,
        totalDeploymentEscrowUUSDC: balances.deploymentEscrowUUSDC,
        totalDeploymentEscrowUSD: balances.totalDeploymentEscrowUSD,
        totalDeploymentGrantsUAKT: balances.deploymentGrantsUAKT,
        totalDeploymentGrantsUUSDC: balances.deploymentEscrowUAKT,
        totalDeploymentGrantsUSD: totalDeploymentGrantsUSD
      });
    }
  }, [isLoaded, price, balances, isManaged, udenomToUsd]);

  return {
    balance: walletBalance,
    isLoading: isLoadingBalances,
    refetch
  };
};

type DenomData = {
  min: number;
  max: number;
  label: string;
  balance: number;
};

export const useDenomData = (denom: string) => {
  const { isLoaded, price, aktToUSD } = usePricing();
  const { balance: walletBalance } = useWalletBalance();
  const [depositData, setDepositData] = useState<DenomData | null>(null);
  const usdcIbcDenom = useUsdcDenom();
  const { minDeposit } = useChainParam();
  const { isManaged } = useWallet();
  const txFeeBuffer = isManaged ? 0 : TX_FEE_BUFFER;

  useEffect(() => {
    if (isLoaded && walletBalance && minDeposit?.akt && minDeposit?.usdc && price) {
      let depositData: DenomData | null = null;
      switch (denom) {
        case UAKT_DENOM:
          depositData = {
            min: minDeposit.akt,
            label: "AKT",
            balance: uaktToAKT(walletBalance.balanceUAKT, 6),
            max: uaktToAKT(Math.max(walletBalance.balanceUAKT - txFeeBuffer, 0), 6)
          };
          break;
        case usdcIbcDenom:
          depositData = {
            min: minDeposit.usdc,
            label: "USDC",
            balance: udenomToDenom(walletBalance.balanceUUSDC, 6),
            max: udenomToDenom(Math.max(walletBalance.balanceUUSDC - txFeeBuffer, 0), 6)
          };
          break;
        default:
          break;
      }

      if (depositData && isManaged) {
        depositData.label = "USD";

        if (denom === UAKT_DENOM) {
          depositData.balance = aktToUSD(depositData.balance) || 0;
          depositData.min = aktToUSD(depositData.min) || 0;
          depositData.max = aktToUSD(depositData.max) || 0;
        }
      }

      setDepositData(depositData);
    }
  }, [denom, isLoaded, price, walletBalance, usdcIbcDenom, minDeposit, isManaged, txFeeBuffer, aktToUSD]);

  return depositData;
};
