import React from "react";
import { FormattedNumber } from "react-intl";
import { Button, buttonVariants, Card, CardContent, Separator } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CoinsSwap, HandCard } from "iconoir-react";

import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useManagedEscrowFaqModal } from "@src/hooks/useManagedEscrowFaqModal";
import type { WalletBalance } from "@src/hooks/useWalletBalance";
import { UrlService } from "@src/utils/urlUtils";
import { LinkTo } from "../../shared/LinkTo";
import { AddFundsLink } from "../../user/AddFundsLink";

interface ManagedWalletPopupProps extends React.PropsWithChildren {
  walletBalance?: WalletBalance | null;
  dependencies?: typeof DEPENDENCIES;
}

export const DEPENDENCIES = {
  Card,
  CardContent,
  Separator,
  Button,
  LinkTo,
  AddFundsLink,
  CoinsSwap,
  HandCard,
  FormattedNumber,
  useWallet,
  useManagedEscrowFaqModal,
  useSelectedChain
};

export const ManagedWalletPopup: React.FC<ManagedWalletPopupProps> = ({ walletBalance, dependencies: d = DEPENDENCIES }) => {
  const { isManaged, isTrialing, switchWalletType } = d.useWallet();
  const { showManagedEscrowFaqModal } = d.useManagedEscrowFaqModal();
  const { connect, isWalletConnected } = d.useSelectedChain();

  return (
    <div className="w-[300px] p-2">
      {isManaged && isTrialing && (
        <div className="mb-2 text-sm font-bold">
          <p className="text-center">Free Trial</p>
        </div>
      )}
      <d.Card>
        {walletBalance ? (
          <d.CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between space-x-2">
              <span className="text-xs">Credits Remaining:</span>
              <span>
                <d.FormattedNumber
                  value={walletBalance.totalDeploymentGrantsUSD}
                  // eslint-disable-next-line react/style-prop-object
                  style="currency"
                  currency="USD"
                />
              </span>
            </div>

            <d.Separator />

            <div className="flex items-center justify-between space-x-2">
              <span className="text-xs">Deposits:</span>
              <span>
                <d.FormattedNumber
                  value={walletBalance.totalDeploymentEscrowUSD}
                  // eslint-disable-next-line react/style-prop-object
                  style="currency"
                  currency="USD"
                />
              </span>
            </div>
          </d.CardContent>
        ) : (
          <d.CardContent className="p-4 text-xs">Wallet Balance is unknown because the blockchain is unavailable</d.CardContent>
        )}
      </d.Card>
      <div className="mb-2 mt-1 flex items-center justify-end">
        <d.LinkTo className="text-xs text-foreground no-underline" onClick={() => showManagedEscrowFaqModal()}>
          What's this?
        </d.LinkTo>
      </div>

      {isManaged && isTrialing && (
        <div className="my-2 text-center text-xs text-muted-foreground">
          Once your Free credits run out, deployments will automatically close. To continue, create an account and add funds with your credit card. Deployments
          from your Free Trial get transferred when creating a new account.
        </div>
      )}

      <div className="flex flex-col items-center justify-end space-y-2 pt-2">
        <d.AddFundsLink className={cn("w-full space-x-2 hover:no-underline", buttonVariants({ variant: "default" }))} href={UrlService.payment()}>
          <d.HandCard className="text-xs" />
          <span className="whitespace-nowrap">Add Funds</span>
        </d.AddFundsLink>
        <d.Separator className="my-2 bg-secondary/90 dark:bg-white/10" />
        <d.Button onClick={isWalletConnected ? switchWalletType : connect} variant="outline" className="w-full space-x-2">
          <d.CoinsSwap />
          <span>Switch to Wallet Payments</span>
        </d.Button>
      </div>
    </div>
  );
};
