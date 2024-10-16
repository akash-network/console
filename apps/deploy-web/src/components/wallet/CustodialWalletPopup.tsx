import { Address, Button, Separator } from "@akashnetwork/ui/components";
import { WalletBalance } from "@src/hooks/useWalletBalance";
import { CoinsSwap } from "iconoir-react";
import { Bank, LogOut } from "iconoir-react";
import React from "react";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { uaktToAKT } from "@src/utils/priceUtils";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { useWallet } from "@src/context/WalletProvider";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { PriceValue } from "../shared/PriceValue";
import { UAKT_DENOM } from "@src/config/denom.config";
import { FormattedNumber } from "react-intl";

interface CustodialWalletPopupProps extends React.PropsWithChildren {
  walletBalance: WalletBalance;
}

const withBilling = browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED;

export const CustodialWalletPopup: React.FC<CustodialWalletPopupProps> = ({ walletBalance }) => {
  const { address, logout, switchWalletType } = useWallet();
  const router = useRouter();
  const onAuthorizeSpendingClick = () => {
    router.push(UrlService.settingsAuthorizations());
  };

  return (
    <div className="w-[300px] p-2">
      <div className="mb-4">
        <Address address={address} isCopyable disableTooltip className="flex items-center justify-between text-sm font-bold text-foreground" showIcon />
      </div>

      <div className="mb-1 text-xs text-muted-foreground">Wallet Balance</div>
      <div className="mb-4 rounded-md border border-success/10 bg-success/10 p-2 text-success dark:border-success/80 dark:bg-success/80 dark:text-foreground">
        <div className="flex items-center justify-between space-x-2">
          <span className="text-xs">AKT</span>
          <span className="flex items-center space-x-1">
            <PriceValue denom={UAKT_DENOM} value={uaktToAKT(walletBalance.totalUAKT, 2)} />
            <span className="text-xs font-light">({uaktToAKT(walletBalance.totalUAKT, 2)} AKT)</span>
          </span>
        </div>

        <Separator className="my-2 bg-success/10 dark:bg-white/20" />

        <div className="flex items-center justify-between space-x-2">
          <span className="text-xs">USDC</span>
          <span>
            <FormattedNumber value={udenomToDenom(walletBalance.totalUUSDC, 2)} style="currency" currency="USD" />
          </span>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">Wallet Actions</div>

      <div className="flex flex-col items-center justify-end space-y-2 pt-2">
        <Button onClick={() => onAuthorizeSpendingClick()} variant="outline" className="w-full space-x-2">
          <Bank />
          <span>Authorize Spending</span>
        </Button>
        <Button onClick={logout} variant="outline" className="w-full space-x-2">
          <LogOut />
          <span>Disconnect Wallet</span>
        </Button>
        {withBilling && (
          <>
            <Separator className="my-4" />

            <Button onClick={switchWalletType} variant="outline" className="w-full space-x-2">
              <CoinsSwap />
              <span>Switch to USD billing</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
