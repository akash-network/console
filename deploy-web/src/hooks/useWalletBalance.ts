import { useWallet } from "@src/context/WalletProvider";
import { usePricing } from "@src/context/PricingProvider";
import { txFeeBuffer, uAktDenom } from "@src/utils/constants";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { useEffect, useState } from "react";
import { useUsdcDenom } from "./useDenom";
import { useDepositParams } from "@src/queries/useSettings";
import { DepositParams } from "@src/types/deployment";

export const useTotalWalletBalance = () => {
  const { isLoaded, price } = usePricing();
  const { walletBalances } = useWallet();
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (isLoaded && walletBalances && price) {
      const aktUsdValue = uaktToAKT(walletBalances.uakt, 6) * price;
      const totalUsdValue = udenomToDenom(walletBalances.usdc, 6);

      setWalletBalance(aktUsdValue + totalUsdValue);
    }
  }, [isLoaded, price, walletBalances]);

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
  const { data: depositParams, refetch: getDepositParams } = useDepositParams({ enabled: false });

  useEffect(() => {
    getDepositParams();
  }, []);

  useEffect(() => {
    if (isLoaded && walletBalances && depositParams) {
      let depositData: DenomData | null = null,
        params: DepositParams | undefined;
      switch (denom) {
        case uAktDenom:
          params = depositParams.find(p => p.denom === uAktDenom);
          depositData = {
            min: uaktToAKT(parseInt(params?.amount || "0")),
            label: "AKT",
            balance: uaktToAKT(walletBalances.uakt, 6),
            inputMax: uaktToAKT(Math.max(walletBalances.uakt - txFeeBuffer, 0), 6)
          };
          break;
        case usdcIbcDenom:
          params = depositParams.find(p => p.denom === usdcIbcDenom);
          depositData = {
            min: udenomToDenom(parseInt(params?.amount || "0")),
            label: "USDC",
            balance: udenomToDenom(walletBalances.usdc, 6),
            inputMax: udenomToDenom(Math.max(walletBalances.usdc - txFeeBuffer, 0), 6)
          };
          break;
        default:
          break;
      }

      setDepositData(depositData);
    }
  }, [denom, isLoaded, price, walletBalances, usdcIbcDenom, depositParams]);

  return depositData;
};
