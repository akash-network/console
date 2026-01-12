"use client";
import React, { useState } from "react";
import { FormattedNumber } from "react-intl";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import { NavArrowDown, Wallet } from "iconoir-react";
import { useAtom } from "jotai";

import { ConnectManagedWalletButton } from "@src/components/wallet/ConnectManagedWalletButton";
import { useWallet } from "@src/context/WalletProvider";
import { getSplitText } from "@src/hooks/useShortText";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import walletStore from "@src/store/walletStore";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { CustodialWalletPopup } from "../wallet/CustodialWalletPopup";
import { ManagedWalletPopup } from "../wallet/ManagedWalletPopup";

export function WalletStatus() {
  const { walletName, isWalletLoaded, isWalletConnected, isManaged, isWalletLoading, isTrialing } = useWallet();
  const { balance: walletBalance, isLoading: isWalletBalanceLoading } = useWalletBalance();
  const [isSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);
  const [open, setOpen] = useState(false);
  const isLoadingBalance = isWalletBalanceLoading && !walletBalance;
  const isInit = isWalletLoaded && !isWalletLoading && !isLoadingBalance;

  return (
    <>
      {isInit ? (
        isWalletConnected ? (
          <div className="flex w-full items-center">
            <div className="w-full py-2">
              <DropdownMenu modal={false} open={open}>
                <DropdownMenuTrigger asChild>
                  <div
                    className={cn("flex items-center justify-center space-x-2 rounded-md border bg-accent px-4 py-2 text-sm hover:bg-accent/80")}
                    onMouseOver={() => setOpen(true)}
                  >
                    <div className="flex items-center space-x-2" aria-label="Connected wallet name and balance">
                      <Wallet className="text-xs" />
                      {isManaged && isTrialing && <span className="text-xs">Trial</span>}
                      {!isManaged && (
                        <>
                          {walletName?.length > 20 ? (
                            <span className="text-xs">{getSplitText(walletName, 4, 4)}</span>
                          ) : (
                            <span className="text-xs">{walletName}</span>
                          )}
                        </>
                      )}
                    </div>

                    {walletBalance && ((isManaged && isTrialing) || !isManaged) && <div className="text-muted-foreground">|</div>}

                    <div className="text-xs">
                      {walletBalance && (
                        <FormattedNumber
                          value={isManaged ? walletBalance.totalDeploymentGrantsUSD : walletBalance.totalUsd}
                          // eslint-disable-next-line react/style-prop-object
                          style="currency"
                          currency="USD"
                        />
                      )}
                    </div>

                    <div>
                      <NavArrowDown className="text-xs" />
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onMouseLeave={() => {
                    setOpen(false);
                  }}
                >
                  <ClickAwayListener
                    onClickAway={() => {
                      setOpen(false);
                    }}
                  >
                    <div>
                      {!isManaged && <CustodialWalletPopup walletBalance={walletBalance} />}
                      {isManaged && <ManagedWalletPopup walletBalance={walletBalance} />}
                    </div>
                  </ClickAwayListener>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {!isSignedInWithTrial && <ConnectManagedWalletButton className="mb-2 mr-2 w-full md:mb-0 md:w-auto" />}
            <ConnectWalletButton className="w-full md:w-auto" />
          </div>
        )
      ) : (
        <div className="flex items-center justify-center p-4">
          <Spinner size="medium" />
        </div>
      )}
    </>
  );
}
