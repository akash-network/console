"use client";
import React, { useState } from "react";
import { FormattedNumber } from "react-intl";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import { NavArrowDown, Wallet } from "iconoir-react";
import { useAtom } from "jotai";

import { ConnectManagedWalletButton } from "@src/components/wallet/ConnectManagedWalletButton";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { useWallet } from "@src/context/WalletProvider";
import { getSplitText } from "@src/hooks/useShortText";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import walletStore from "@src/store/walletStore";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { CustodialWalletPopup } from "../wallet/CustodialWalletPopup";
import { ManagedWalletPopup } from "../wallet/ManagedWalletPopup";

const withBilling = browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED;

export function WalletStatus() {
  const { walletName, isWalletLoaded, isWalletConnected, isManaged, isWalletLoading, isTrialing } = useWallet();
  const { balance: walletBalance } = useWalletBalance();
  const [isSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);
  const [open, setOpen] = useState(false);

  return (
    <>
      {isWalletLoaded && !isWalletLoading ? (
        isWalletConnected ? (
          <div className="flex items-center">
            <div className="py-2">
              <DropdownMenu modal={false} open={open}>
                <DropdownMenuTrigger asChild>
                  {!!walletBalance && (
                    <div
                      className={cn("flex items-center rounded-md border px-4 py-2 text-sm", {
                        "border-primary bg-primary/10 text-primary dark:bg-primary dark:text-primary-foreground": isManaged,
                        "bg-background text-foreground": !isManaged
                      })}
                      onMouseOver={() => setOpen(true)}
                    >
                      <div className="flex items-center space-x-2">
                        {isManaged && isTrialing && <span className="text-xs">Trial</span>}
                        {!isManaged && (
                          <>
                            <Wallet className="text-xs" />
                            {walletName?.length > 20 ? (
                              <span className="text-xs">{getSplitText(walletName, 4, 4)}</span>
                            ) : (
                              <span className="text-xs">{walletName}</span>
                            )}
                          </>
                        )}
                      </div>

                      {(isManaged && isTrialing) || (!isManaged && <div className="px-2">|</div>)}

                      <div className="text-xs">
                        <FormattedNumber
                          value={isManaged ? walletBalance.totalDeploymentGrantsUSD : walletBalance.totalUsd}
                          // eslint-disable-next-line react/style-prop-object
                          style="currency"
                          currency="USD"
                        />
                      </div>

                      <div>
                        <NavArrowDown className="ml-2 text-xs" />
                      </div>
                    </div>
                  )}
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
                      {!isManaged && walletBalance && <CustodialWalletPopup walletBalance={walletBalance} />}
                      {withBilling && isManaged && walletBalance && <ManagedWalletPopup walletBalance={walletBalance} />}
                    </div>
                  </ClickAwayListener>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          <div>
            {withBilling && !isSignedInWithTrial && <ConnectManagedWalletButton className="mb-2 mr-2 w-full md:mb-0 md:w-auto" />}
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
