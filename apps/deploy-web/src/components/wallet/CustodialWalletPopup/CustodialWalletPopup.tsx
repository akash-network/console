import React from "react";
import { FormattedNumber } from "react-intl";
import { Address, Button, buttonVariants, Card, CardContent, Separator } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Bank, LogOut } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { useRouter } from "next/router";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useWallet } from "@src/context/WalletProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useSupportsACT } from "@src/hooks/useSupportsACT/useSupportsACT";
import type { WalletBalance } from "@src/hooks/useWalletBalance";
import walletStore from "@src/store/walletStore";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { UrlService } from "@src/utils/urlUtils";
import { PriceValue } from "../../shared/PriceValue";
import { ConnectManagedWalletButton } from "../ConnectManagedWalletButton";

interface CustodialWalletPopupProps extends React.PropsWithChildren {
  walletBalance?: WalletBalance | null;
  dependencies?: typeof DEPENDENCIES;
}

export const DEPENDENCIES = {
  Address,
  Card,
  CardContent,
  Separator,
  Button,
  Bank,
  LogOut,
  Link,
  FormattedNumber,
  ConnectManagedWalletButton,
  PriceValue,
  useWallet,
  useRouter,
  useCustomUser,
  useSupportsACT
};

export const CustodialWalletPopup: React.FC<CustodialWalletPopupProps> = ({ walletBalance, dependencies: d = DEPENDENCIES }) => {
  const { address, logout } = d.useWallet();
  const router = d.useRouter();
  const [isSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);
  const { user } = d.useCustomUser();
  const isACTSupported = d.useSupportsACT();

  const onAuthorizeSpendingClick = () => {
    router.push(UrlService.settingsAuthorizations());
  };

  return (
    <div className="w-[300px] p-2">
      <div className="mb-4">
        <d.Address
          address={address}
          isCopyable
          disableTooltip
          showIcon
          className="flex items-center justify-between text-sm font-bold text-foreground"
          aria-label="wallet address"
        />
      </div>

      <div className="mb-1 text-xs text-muted-foreground">Wallet Balance</div>
      <d.Card className="mb-4">
        {walletBalance ? (
          <d.CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between space-x-2">
              <span className="text-xs">AKT</span>
              <span className="flex items-center space-x-1">
                <d.PriceValue denom={UAKT_DENOM} value={uaktToAKT(walletBalance.totalUAKT, 2)} />
                <span className="text-xs font-light">({uaktToAKT(walletBalance.totalUAKT, 2)} AKT)</span>
              </span>
            </div>

            <d.Separator />

            <div className="flex items-center justify-between space-x-2">
              <span className="text-xs">{isACTSupported ? "ACT" : "USDC"}</span>
              <span>
                {isACTSupported ? (
                  <d.FormattedNumber value={udenomToDenom(walletBalance.totalUACT, 2)} style="currency" currency="USD" />
                ) : (
                  <d.FormattedNumber value={udenomToDenom(walletBalance.totalUUSDC, 2)} style="currency" currency="USD" />
                )}
              </span>
            </div>
          </d.CardContent>
        ) : (
          <d.CardContent className="p-4 text-xs">Wallet Balance is unknown because the blockchain is unavailable</d.CardContent>
        )}
      </d.Card>

      <div className="text-xs text-muted-foreground">Wallet Actions</div>

      <div className="flex flex-col items-center justify-end space-y-2 pt-2">
        <d.Button onClick={() => onAuthorizeSpendingClick()} variant="outline" className="w-full space-x-2">
          <d.Bank />
          <span>Authorize Spending</span>
        </d.Button>
        <d.Button onClick={logout} variant="outline" className="w-full space-x-2">
          <d.LogOut />
          <span>Disconnect Wallet</span>
        </d.Button>
        <d.Separator className="my-4" />

        {isSignedInWithTrial && !user ? (
          <d.Link className={cn(buttonVariants({ variant: "outline" }), "w-full space-x-2")} href={UrlService.newLogin()}>
            Sign in for USD Payments
          </d.Link>
        ) : (
          <d.ConnectManagedWalletButton className="w-full" />
        )}
      </div>
    </div>
  );
};
