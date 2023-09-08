import { useKeplr } from "@src/context/KeplrWalletProvider";
import { usePricing } from "@src/context/PricingProvider";
import { txFeeBuffer, uAktDenom } from "@src/utils/constants";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { useEffect, useState } from "react";
import { useUsdcDenom } from "./useDenom";

export const useTotalWalletBalance = () => {
  const { isLoaded, price } = usePricing();
  const { walletBalances } = useKeplr();
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (isLoaded && walletBalances) {
      const aktUsdValue = uaktToAKT(walletBalances.uakt, 6) * price;
      const totalUsdValue = udenomToDenom(walletBalances.usdc, 6);

      setWalletBalance(aktUsdValue + totalUsdValue);
    }
  }, [isLoaded, price, walletBalances]);

  return walletBalance;
};

type DenomData = {
  label: string;
  balance: number;
  inputMax: number;
};

export const useDenomData = (denom: string) => {
  const { isLoaded, price } = usePricing();
  const { walletBalances } = useKeplr();
  const [depositData, setDepositData] = useState<DenomData>(null);
  const usdcIbcDenom = useUsdcDenom();

  useEffect(() => {
    if (isLoaded && walletBalances) {
      let depositData: DenomData = null;
      switch (denom) {
        case uAktDenom:
          depositData = {
            label: "AKT",
            balance: uaktToAKT(walletBalances.uakt, 6),
            inputMax: uaktToAKT(Math.max(walletBalances.uakt - txFeeBuffer, 0), 6)
          };
          break;
        case usdcIbcDenom:
          depositData = {
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
  }, [denom, isLoaded, price, walletBalances, usdcIbcDenom]);

  return depositData;
};
