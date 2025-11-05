import { useEffect, useState } from "react";
import { useAtom } from "jotai";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useChainParam } from "@src/context/ChainParamProvider";
import { usePricing } from "@src/context/PricingProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useBalances } from "@src/queries/useBalancesQuery";
import walletStore from "@src/store/walletStore";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { useUsdcDenom } from "./useDenom";
import { useManagedWallet } from "./useManagedWallet";

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
        (sum, grant) => sum + udenomToUsd(grant.authorization.spend_limit.amount, grant.authorization.spend_limit.denom),
        0
      );

      setWalletBalance({
        totalUsd: aktUsdValue + totalUsdcValue + totalDeploymentEscrowUSD + totalDeploymentGrantsUSD,
        balanceUAKT: balances.balanceUAKT + balances.deploymentGrantsUAKT,
        balanceUUSDC: balances.balanceUUSDC + balances.deploymentGrantsUUSDC,
        totalUAKT: balances.balanceUAKT + balances.deploymentEscrowUAKT + balances.deploymentGrantsUAKT,
        totalUUSDC: balances.balanceUUSDC + balances.deploymentEscrowUUSDC + balances.deploymentGrantsUUSDC,
        totalDeploymentEscrowUAKT: balances.deploymentEscrowUAKT,
        totalDeploymentEscrowUUSDC: balances.deploymentEscrowUUSDC,
        totalDeploymentEscrowUSD: totalDeploymentEscrowUSD,
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

export const useDenomData = (denom?: string) => {
  const { isLoaded, price, aktToUSD } = usePricing();
  const { balance: walletBalance } = useWalletBalance();
  const [depositData, setDepositData] = useState<DenomData | null>(null);
  const usdcIbcDenom = useUsdcDenom();
  const { minDeposit } = useChainParam();
  const { isManaged } = useWallet();
  const txFeeBuffer = isManaged ? 0 : TX_FEE_BUFFER;

  useEffect(() => {
    if (isLoaded && walletBalance && (minDeposit?.akt || minDeposit?.usdc) && price) {
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

export type TrialBalance = {
  total: number;
  remaining: number;
  used: number;
  usagePercentage: number;
  isLoading: boolean;
  trialEndDate: Date | null;
  daysRemaining: number;
};

export const useTrialBalance = (): TrialBalance => {
  const { creditAmount } = useWallet();
  const { balance: walletBalance, isLoading } = useWalletBalance();
  const { wallet: managedWallet } = useManagedWallet();
  const { appConfig } = useServices();

  const TRIAL_TOTAL = appConfig.NEXT_PUBLIC_TRIAL_CREDITS_AMOUNT;
  const TRIAL_DURATION_DAYS = appConfig.NEXT_PUBLIC_TRIAL_DURATION_DAYS;

  const creditsRemaining = walletBalance?.totalDeploymentGrantsUSD || creditAmount || TRIAL_TOTAL;
  const creditsUsed = TRIAL_TOTAL - creditsRemaining;
  const usagePercentage = Math.min(Math.max((creditsRemaining / TRIAL_TOTAL) * 100, 0), 100);

  // Calculate trial end date from wallet creation date
  let trialEndDate: Date | null = null;
  let daysRemaining = TRIAL_DURATION_DAYS;

  if (managedWallet?.createdAt) {
    const createdAt = new Date(managedWallet.createdAt);
    trialEndDate = new Date(createdAt);
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);

    const now = new Date();
    const timeRemaining = trialEndDate.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
  }

  return {
    total: TRIAL_TOTAL,
    remaining: creditsRemaining,
    used: creditsUsed,
    usagePercentage,
    isLoading,
    trialEndDate,
    daysRemaining
  };
};
