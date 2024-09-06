import { useEffect, useState } from "react";

import { UAKT_DENOM } from "@src/config/denom.config";
import { TX_FEE_BUFFER } from "@src/config/tx.config";
import { useChainParam } from "@src/context/ChainParamProvider";
import { usePricing } from "@src/context/PricingProvider";
import { useWallet } from "@src/context/WalletProvider";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { useUsdcDenom } from "./useDenom";
import { useBalances } from "@src/queries/useBalancesQuery";

export type TotalWalletBalance = {
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

export type TotalWalletBalanceReturnType = {
  isLoadingBalances: boolean;
  fetchBalances: () => void;
  walletBalance: TotalWalletBalance | null;
};

export const useTotalWalletBalance = (): TotalWalletBalanceReturnType => {
  const { isLoaded, price } = usePricing();
  const { address, isManaged } = useWallet();
  const usdcIbcDenom = useUsdcDenom();
  const { data: balances, isFetching: isLoadingBalances, refetch: fetchBalances } = useBalances(address);
  const [walletBalance, setWalletBalance] = useState<TotalWalletBalance | null>(null);

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
      const totalDeploymentGrantsUSD = balances.deploymentGrants.grants.reduce(
        (acc, d) => acc + udenomToUsd(d.authorization.spend_limit.amount, d.authorization.spend_limit.denom),
        0
      );
      const totalGrantsUAKT = balances.deploymentGrants.grants
        .filter(d => d.authorization.spend_limit.denom === UAKT_DENOM)
        .reduce((acc, d) => acc + parseFloat(d.authorization.spend_limit.amount), 0);
      const totalGrantsUUSDC = balances.deploymentGrants.grants
        .filter(d => d.authorization.spend_limit.denom === usdcIbcDenom)
        .reduce((acc, d) => acc + parseFloat(d.authorization.spend_limit.amount), 0);

      setWalletBalance({
        totalUsd: aktUsdValue + totalUsdcValue + totalDeploymentEscrowUSD + totalDeploymentGrantsUSD,
        balanceUAKT: balances.balanceUAKT + totalGrantsUAKT,
        balanceUUSDC: balances.balanceUUSDC + totalGrantsUUSDC,
        totalUAKT: balances.balanceUAKT + balances.deploymentEscrowUAKT + totalGrantsUAKT,
        totalUUSDC: balances.balanceUUSDC + balances.deploymentEscrowUUSDC + totalGrantsUUSDC,
        totalDeploymentEscrowUAKT: balances.deploymentEscrowUAKT,
        totalDeploymentEscrowUUSDC: balances.deploymentEscrowUUSDC,
        totalDeploymentEscrowUSD: totalDeploymentEscrowUSD,
        totalDeploymentGrantsUAKT: totalGrantsUAKT,
        totalDeploymentGrantsUUSDC: totalGrantsUUSDC,
        totalDeploymentGrantsUSD: totalDeploymentGrantsUSD
      });
    }
  }, [isLoaded, price, balances, isManaged]);

  const udenomToUsd = (amount: string, denom: string) => {
    let value = 0;

    if (denom === UAKT_DENOM) {
      value = uaktToAKT(parseFloat(amount), 6) * (price || 0);
    } else if (denom === usdcIbcDenom) {
      value = udenomToDenom(parseFloat(amount), 6);
    }

    return value;
  };

  return {
    walletBalance,
    isLoadingBalances,
    fetchBalances
  };
};

type DenomData = {
  min: number;
  label: string;
  balance: number;
  inputMax: number;
};

export const useDenomData = (denom: string) => {
  const { isLoaded, price } = usePricing();
  const { walletBalance } = useTotalWalletBalance();
  const [depositData, setDepositData] = useState<DenomData | null>(null);
  const usdcIbcDenom = useUsdcDenom();
  const { minDeposit } = useChainParam();

  useEffect(() => {
    if (isLoaded && walletBalance && minDeposit?.akt && minDeposit?.usdc && price) {
      let depositData: DenomData | null = null;
      switch (denom) {
        case UAKT_DENOM:
          depositData = {
            min: minDeposit.akt,
            label: "AKT",
            balance: uaktToAKT(walletBalance.balanceUAKT, 6),
            inputMax: uaktToAKT(Math.max(walletBalance.balanceUAKT - TX_FEE_BUFFER, 0), 6)
          };
          break;
        case usdcIbcDenom:
          depositData = {
            min: minDeposit.usdc,
            label: "USDC",
            balance: udenomToDenom(walletBalance.balanceUUSDC, 6),
            inputMax: udenomToDenom(Math.max(walletBalance.balanceUUSDC - TX_FEE_BUFFER, 0), 6)
          };
          break;
        default:
          break;
      }

      setDepositData(depositData);
    }
  }, [denom, isLoaded, price, walletBalance, usdcIbcDenom, minDeposit]);

  return depositData;
};
