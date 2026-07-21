"use client";
import { FormattedNumber } from "react-intl";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, Skeleton } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowDown, Wallet } from "iconoir-react";

import { useWallet } from "@src/context/WalletProvider";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { ManagedWalletPopup } from "../wallet/ManagedWalletPopup/ManagedWalletPopup";
import { WalletConnectionButtons } from "../wallet/WalletConnectionButtons";

export const DEPENDENCIES = {
  useWallet,
  useWalletBalance,
  ManagedWalletPopup,
  WalletConnectionButtons,
  FormattedNumber
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function WalletStatus({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { isWalletLoaded, isWalletConnected, isWalletLoading, isTrialing } = d.useWallet();
  const { balance: walletBalance, isLoading: isWalletBalanceLoading } = d.useWalletBalance();
  const isLoadingBalance = isWalletBalanceLoading && !walletBalance;
  const isInit = isWalletLoaded && !isWalletLoading && !isLoadingBalance;

  return (
    <>
      {isInit ? (
        isWalletConnected ? (
          <div className="flex w-full items-center">
            <div className="w-full py-2">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <div
                    className={cn(
                      "flex cursor-pointer items-center justify-center space-x-2 rounded-md border bg-accent px-4 py-2 text-sm hover:bg-accent/80 [&_*]:cursor-pointer"
                    )}
                  >
                    <div className="flex items-center space-x-2" aria-label="Connected wallet name and balance">
                      <Wallet className="text-xs" />
                      {isTrialing && <span className="text-xs">Trial</span>}
                    </div>

                    {walletBalance && isTrialing && <div className="text-muted-foreground">|</div>}

                    <div className="text-xs">
                      {walletBalance && <d.FormattedNumber value={walletBalance.totalDeploymentGrantsUSD} style="currency" currency="USD" />}
                    </div>

                    <div>
                      <NavArrowDown className="text-xs" />
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div>
                    <d.ManagedWalletPopup walletBalance={walletBalance} />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          <d.WalletConnectionButtons className="w-full justify-center" />
        )
      ) : (
        <div className="flex items-center space-x-2 rounded-md border bg-accent px-4 py-2">
          <Skeleton className="h-4 w-4 rounded-full bg-muted-foreground/20" />
          <Skeleton className="h-4 w-20 bg-muted-foreground/20" />
          <div className="text-muted-foreground">|</div>
          <Skeleton className="h-4 w-16 bg-muted-foreground/20" />
          <Skeleton className="h-4 w-4 bg-muted-foreground/20" />
        </div>
      )}
    </>
  );
}
