import { useEffect, useMemo } from "react";
import { useAtom } from "jotai";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import { useWallet } from "@src/context/WalletProvider";
import { useChainParam } from "@src/hooks/useChainParam/useChainParam";
import { useBalances } from "@src/queries/useBalancesQuery";
import walletStore from "@src/store/walletStore";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { usePricing } from "./usePricing/usePricing";
import { useUsdcDenom } from "./useDenom";

export const TX_FEE_BUFFER = 10_000;

export type WalletBalance = {
  totalUsd: number;
  balanceUAKT: number;
  balanceUUSDC: number;
  balanceUACT: number;
  totalUAKT: number;
  totalUUSDC: number;
  totalUACT: number;
  totalDeploymentEscrowUAKT: number;
  totalDeploymentEscrowUUSDC: number;
  totalDeploymentEscrowUACT: number;
  totalDeploymentEscrowUSD: number;
  totalDeploymentGrantsUAKT: number;
  totalDeploymentGrantsUUSDC: number;
  totalDeploymentGrantsUACT: number;
  totalDeploymentGrantsUSD: number;
};

export type WalletBalanceReturnType = {
  isLoading: boolean;
  refetch: () => void;
  balance: WalletBalance | null;
};

export const useWalletBalance = (): WalletBalanceReturnType => {
  const { isLoaded, price, udenomToUsd } = usePricing();
  const { address, isManaged } = useWallet();
  const { data: balances, isFetching: isLoadingBalances, refetch } = useBalances(address);
  const [walletBalance, setWalletBalance] = useAtom(walletStore.balance);

  useEffect(() => {
    if (isLoaded && balances && price) {
      const aktUsdValue = uaktToAKT(balances.balanceUAKT, 6) * price;
      const totalUsdcValue = udenomToDenom(balances.balanceUUSDC, 6);
      const totalDeploymentEscrowUSD = balances.activeDeployments.reduce(
        (acc, d) => acc + d.escrowAccount.state.funds.reduce((fundAcc, fund) => fundAcc + udenomToUsd(fund.amount, fund.denom), 0),
        0
      );
      const { deploymentGrants } = balances;
      const totalDeploymentGrantsUSD = deploymentGrants.reduce(
        (sum, grant) => sum + grant.authorization.spend_limits.reduce((grantSum, spendLimit) => grantSum + udenomToUsd(spendLimit.amount, spendLimit.denom), 0),
        0
      );

      setWalletBalance({
        totalUsd: aktUsdValue + totalUsdcValue + udenomToUsd(balances.balanceUACT, UACT_DENOM) + totalDeploymentEscrowUSD + totalDeploymentGrantsUSD,
        balanceUAKT: balances.balanceUAKT + balances.deploymentGrantsUAKT,
        balanceUUSDC: balances.balanceUUSDC + balances.deploymentGrantsUUSDC,
        balanceUACT: balances.balanceUACT + balances.deploymentGrantsUACT,
        totalUAKT: balances.balanceUAKT + balances.deploymentEscrowUAKT + balances.deploymentGrantsUAKT,
        totalUUSDC: balances.balanceUUSDC + balances.deploymentEscrowUUSDC + balances.deploymentGrantsUUSDC,
        totalUACT: balances.balanceUACT + balances.deploymentEscrowUACT + balances.deploymentGrantsUACT,
        totalDeploymentEscrowUAKT: balances.deploymentEscrowUAKT,
        totalDeploymentEscrowUUSDC: balances.deploymentEscrowUUSDC,
        totalDeploymentEscrowUACT: balances.deploymentEscrowUACT,
        totalDeploymentEscrowUSD: totalDeploymentEscrowUSD,
        totalDeploymentGrantsUAKT: balances.deploymentGrantsUAKT,
        totalDeploymentGrantsUUSDC: balances.deploymentGrantsUUSDC,
        totalDeploymentGrantsUACT: balances.deploymentGrantsUACT,
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

export const useDenomData = (denom?: string) => {
  const { isLoaded, price, aktToUSD } = usePricing();
  const { balance: walletBalance } = useWalletBalance();
  const usdcIbcDenom = useUsdcDenom();
  const { minDeposit } = useChainParam();
  const { isManaged } = useWallet();
  const txFeeBuffer = isManaged ? 0 : TX_FEE_BUFFER;

  const depositData = useMemo(() => {
    if (isLoaded && walletBalance && minDeposit && (minDeposit.akt !== undefined || minDeposit.act !== undefined) && price) {
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
        case UACT_DENOM:
          depositData = {
            min: minDeposit.act,
            label: "ACT",
            balance: udenomToDenom(walletBalance.balanceUACT, 6) || 0,
            max: udenomToDenom(Math.max(walletBalance.balanceUACT - txFeeBuffer, 0), 6) || 0
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

      return depositData;
    }

    return null;
  }, [denom, isLoaded, price, walletBalance, usdcIbcDenom, minDeposit, isManaged, txFeeBuffer, aktToUSD]);

  return depositData;
};
