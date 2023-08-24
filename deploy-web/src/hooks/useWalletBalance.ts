import { useKeplr } from "@src/context/KeplrWalletProvider";
import { usePricing } from "@src/context/PricingProvider";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { useEffect, useState } from "react";

export const useWalletBalance = () => {
  const { isLoaded, price } = usePricing();
  const { walletBalances } = useKeplr();
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (isLoaded) {
      const aktUsdValue = uaktToAKT(walletBalances.uakt, 6) * price;
      const totalUsdValue = udenomToDenom(walletBalances.usdc, 6);

      setWalletBalance(aktUsdValue + totalUsdValue);
    }
  }, [isLoaded, price, walletBalances]);

  return walletBalance;
};
