import { useEffect, useState } from "react";

import { UAKT_DENOM } from "@src/config/denom.config";
import { TX_FEE_BUFFER } from "@src/config/tx.config";
import { useChainParam } from "@src/context/ChainParamProvider";
import { usePricing } from "@src/context/PricingProvider";
import { useWallet } from "@src/context/WalletProvider";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { useUsdcDenom } from "./useDenom";
import { useDeploymentList } from "@src/queries/useDeploymentQuery";
import { useGranteeGrants } from "@src/queries/useGrantsQuery";
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

export const useTotalWalletBalance = (): TotalWalletBalance | null => {
  const { isLoaded, price } = usePricing();
  const { address } = useWallet();
  const usdcIbcDenom = useUsdcDenom();
  const { data: balances } = useBalances(address, { enabled: !!address });
  const { data: deployments } = useDeploymentList(address, { enabled: !!address });
  const { data: deploymentGrants } = useGranteeGrants(address, { enabled: !!address });
  const [walletBalance, setWalletBalance] = useState<TotalWalletBalance | null>(null);

  useEffect(() => {
    if (isLoaded && balances && price && deployments && deploymentGrants) {
      const aktUsdValue = uaktToAKT(balances.balance, 6) * price;
      const totalUsdcValue = udenomToDenom(balances.balanceUsdc, 6);
      const activeDeployments = deployments.filter(d => d.state === "active");
      const aktActiveDeployments = activeDeployments.filter(d => d.denom === uAktDenom);
      const usdcActiveDeployments = activeDeployments.filter(d => d.denom === usdcIbcDenom);
      const totalDeploymentEscrowUAKT = aktActiveDeployments.reduce((acc, d) => acc + d.escrowBalance, 0);
      const totalDeploymentEscrowUUSDC = usdcActiveDeployments.reduce((acc, d) => acc + d.escrowBalance, 0);
      const totalDeploymentEscrowUSD = activeDeployments.reduce((acc, d) => acc + udenomToUsd(d.escrowAccount.funds.amount, d.escrowAccount.funds.denom), 0);
      const totalDeploymentGrantsUSD = deploymentGrants.reduce(
        (acc, d) => acc + udenomToUsd(d.authorization.spend_limit.amount, d.authorization.spend_limit.denom),
        0
      );
      const totalGrantsUAKT = deploymentGrants
        .filter(d => d.authorization.spend_limit.denom === uAktDenom)
        .reduce((acc, d) => acc + parseFloat(d.authorization.spend_limit.amount), 0);
      const totalGrantsUUSDC = deploymentGrants
        .filter(d => d.authorization.spend_limit.denom === usdcIbcDenom)
        .reduce((acc, d) => acc + parseFloat(d.authorization.spend_limit.amount), 0);

      setWalletBalance({
        totalUsd: aktUsdValue + totalUsdcValue + totalDeploymentEscrowUSD + totalDeploymentGrantsUSD,
        balanceUAKT: balances.balance + totalGrantsUAKT,
        balanceUUSDC: balances.balanceUsdc + totalGrantsUUSDC,
        totalUAKT: balances.balance + totalDeploymentEscrowUAKT + totalGrantsUAKT,
        totalUUSDC: balances.balanceUsdc + totalDeploymentEscrowUUSDC + totalGrantsUUSDC,
        totalDeploymentEscrowUAKT: totalDeploymentEscrowUAKT,
        totalDeploymentEscrowUUSDC: totalDeploymentEscrowUUSDC,
        totalDeploymentEscrowUSD: activeDeployments.reduce((acc, d) => acc + udenomToUsd(d.escrowAccount.balance.amount, d.escrowAccount.balance.denom), 0),
        totalDeploymentGrantsUAKT: totalGrantsUAKT,
        totalDeploymentGrantsUUSDC: totalGrantsUUSDC,
        totalDeploymentGrantsUSD: deploymentGrants.reduce(
          (acc, d) => acc + udenomToUsd(d.authorization.spend_limit.amount, d.authorization.spend_limit.denom),
          0
        )
      });
    }
  }, [isLoaded, price, balances, deployments, deploymentGrants]);

  const udenomToUsd = (amount: string, denom: string) => {
    let price = 0;

    if (denom === uAktDenom) {
      price = uaktToAKT(parseFloat(amount), 6) * price;
    } else if (denom === usdcIbcDenom) {
      price = udenomToDenom(parseFloat(amount), 6);
    }

    return price;
  };

  return walletBalance;
};

type DenomData = {
  min: number;
  label: string;
  balance: number;
  inputMax: number;
};

export const useDenomData = (denom: string) => {
  const { isLoaded, price } = usePricing();
  const { walletBalances } = useWallet();
  const [depositData, setDepositData] = useState<DenomData | null>(null);
  const usdcIbcDenom = useUsdcDenom();
  const { minDeposit } = useChainParam();

  useEffect(() => {
    if (isLoaded && walletBalances && minDeposit?.akt && minDeposit?.usdc && price) {
      let depositData: DenomData | null = null;
      switch (denom) {
        case UAKT_DENOM:
          depositData = {
            min: minDeposit.akt,
            label: "AKT",
            balance: uaktToAKT(walletBalances.uakt, 6),
            inputMax: uaktToAKT(Math.max(walletBalances.uakt - TX_FEE_BUFFER, 0), 6)
          };
          break;
        case usdcIbcDenom:
          depositData = {
            min: minDeposit.usdc,
            label: "USDC",
            balance: udenomToDenom(walletBalances.usdc, 6),
            inputMax: udenomToDenom(Math.max(walletBalances.usdc - TX_FEE_BUFFER, 0), 6)
          };
          break;
        default:
          break;
      }

      setDepositData(depositData);
    }
  }, [denom, isLoaded, price, walletBalances, usdcIbcDenom, minDeposit]);

  return depositData;
};
