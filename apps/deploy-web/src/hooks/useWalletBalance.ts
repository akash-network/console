import { useEffect, useState } from "react";

import { UAKT_DENOM } from "@src/config/denom.config";
import { TX_FEE_BUFFER } from "@src/config/tx.config";
import { useChainParam } from "@src/context/ChainParamProvider";
import { usePricing } from "@src/context/PricingProvider";
import { useWallet } from "@src/context/WalletProvider";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { useUsdcDenom } from "./useDenom";

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
