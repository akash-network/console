import React from "react";
import { FormattedNumber } from "react-intl";
import { Address, Button, Separator } from "@akashnetwork/ui/components";
import { LogOut } from "iconoir-react";

import { usePricing } from "@src/context/PricingProvider";
import { useWallet } from "@src/context/WalletProvider";
import { uAktDenom } from "@src/utils/constants";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";

interface WalletPopupProps extends React.PropsWithChildren {
  walletBalances: { uakt: number; usdc: number } | null;
}

export const WalletPopup: React.FC<WalletPopupProps> = ({ walletBalances }) => {
  const { address, logout } = useWallet();
  const { isLoaded, getPriceForDenom } = usePricing();

  const aktAmount = walletBalances ? uaktToAKT(walletBalances.uakt, 2) : 0;
  const aktPrice = getPriceForDenom(uAktDenom);
  const aktUsdValue = isLoaded && walletBalances && aktPrice > 0 ? aktAmount * aktPrice : 0;
  const usdcAmount = walletBalances ? udenomToDenom(walletBalances.usdc, 2) : 0;

  return (
    <div className="w-[300px] p-2">
      <div className="mb-4">
        <Address address={address} isCopyable disableTooltip className="text-foreground flex items-center justify-between text-sm font-bold" showIcon />
      </div>

      <div className="text-muted-foreground mb-1 text-xs">Wallet Balance</div>
      <div className="border-success/10 bg-success/10 text-success dark:border-success/80 dark:bg-success/80 dark:text-foreground mb-4 rounded-md border p-2">
        {walletBalances ? (
          <>
            <div className="flex items-center justify-between space-x-2">
              <span className="text-xs">AKT</span>
              <span className="flex items-center space-x-1">
                {isLoaded && aktPrice ? <FormattedNumber value={aktUsdValue} style="currency" currency="USD" /> : <span className="text-xs">$0.00</span>}
                <span className="font-light2 space-x-2 text-xs">({aktAmount} AKT)</span>
              </span>
            </div>

            <Separator className="bg-success/10 my-2 dark:bg-white/20" />

            <div className="flex items-center justify-between space-x-2">
              <span className="text-xs">USDC</span>
              <span>
                <FormattedNumber value={usdcAmount} style="currency" currency="USD" />
              </span>
            </div>
          </>
        ) : (
          <div className="space-x-2 text-xs text-white">Wallet Balance is unknown because the blockchain is unavailable</div>
        )}
      </div>

      <div className="text-muted-foreground text-xs">Wallet Actions</div>

      <div className="flex flex-col items-center justify-end space-y-2 pt-2">
        <Button onClick={logout} variant="outline" className="w-full space-x-2">
          <LogOut />
          <span>Disconnect Wallet</span>
        </Button>
      </div>
    </div>
  );
};
