"use client";
import React, { useState } from "react";
import { FormattedNumber } from "react-intl";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import { NavArrowDown, Wallet } from "iconoir-react";

import { useWallet } from "@src/context/WalletProvider";
import { useTotalWalletBalance } from "@src/hooks/useWalletBalance";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { WalletPopup } from "../wallet/WalletPopup";

export function WalletStatus() {
  const { walletName, walletBalances, isWalletLoaded, isWalletConnected } = useWallet();
  const walletBalance = useTotalWalletBalance();
  const [open, setOpen] = useState(false);

  const getSplitText = (text: string, start: number, end: number) => {
    if (text.length <= start + end) return text;
    return `${text.slice(0, start)}...${text.slice(-end)}`;
  };

  return (
    <>
      {isWalletLoaded ? (
        isWalletConnected ? (
          <div className="flex w-full items-center">
            <div className="w-full py-2">
              <DropdownMenu modal={false} open={open}>
                <DropdownMenuTrigger asChild>
                  <div
                    className={cn("bg-background text-foreground flex items-center justify-center rounded-md border px-4 py-2 text-sm")}
                    onMouseOver={() => setOpen(true)}
                  >
                    <div className="flex items-center space-x-2" aria-label="Connected wallet name and balance">
                      <Wallet className="text-xs" />
                      {walletName?.length > 20 ? (
                        <span className="text-xs">{getSplitText(walletName, 4, 4)}</span>
                      ) : (
                        <span className="text-xs">{walletName}</span>
                      )}
                    </div>

                    {walletBalance > 0 && <div className="px-2">|</div>}

                    <div className="text-xs">
                      {walletBalance > 0 && (
                        <FormattedNumber
                          value={walletBalance}
                          // eslint-disable-next-line react/style-prop-object
                          style="currency"
                          currency="USD"
                        />
                      )}
                    </div>

                    <div>
                      <NavArrowDown className="ml-2 text-xs" />
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
                      <WalletPopup walletBalances={walletBalances} />
                    </div>
                  </ClickAwayListener>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          <ConnectWalletButton className="w-full md:w-auto" />
        )
      ) : (
        <div className="flex items-center justify-center p-4">
          <Spinner size="medium" />
        </div>
      )}
    </>
  );
}
