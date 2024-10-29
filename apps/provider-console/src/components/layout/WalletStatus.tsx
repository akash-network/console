"use client";
import { FormattedNumber } from "react-intl";
import {
  Address,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@akashnetwork/ui/components";
import { LogOut, MoreHoriz, Wallet } from "iconoir-react";
import Link from "next/link";

import { useWallet } from "@src/context/WalletProvider";
import { useTotalWalletBalance } from "@src/hooks/useWalletBalance";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { FormattedDecimal } from "../shared/FormattedDecimal";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";

export function WalletStatus() {
  const { walletName, address, walletBalances, logout, isWalletLoaded, isWalletConnected } = useWallet();
  const walletBalance = useTotalWalletBalance();

  const onDisconnectClick = () => logout();

  const WalletInfo = () => (
    <div className="flex items-center pr-2">
      <div className="pl-2 pr-2">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHoriz />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDisconnectClick}>
              <LogOut />
              &nbsp;Disconnect Wallet
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center text-left">
        <div className="flex items-center text-sm font-bold">
          <Wallet className="text-xs" />
          <Link className="ml-2 cursor-pointer leading-4" href={`https://stats.akash.network/addresses/${address}`} target="_blank">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{walletName}</span>
              </TooltipTrigger>
              <TooltipContent>
                <Address address={address} isCopyable disableTooltip />
              </TooltipContent>
            </Tooltip>
          </Link>
        </div>

        {walletBalances && (
          <div className="text-muted-foreground ml-2 flex items-center whitespace-nowrap font-bold">
            <Tooltip>
              <TooltipTrigger>
                <Badge className="h-5 text-xs font-bold" variant="secondary">
                  <FormattedNumber
                    value={walletBalance}
                    style="currency"
                    currency="USD"
                  />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-base">
                  <div>
                    <FormattedDecimal value={udenomToDenom(walletBalances.uakt, 2)} />
                    <span className="ml-1 text-xs">AKT</span>
                  </div>
                  <div>
                    <FormattedDecimal value={udenomToDenom(walletBalances.usdc, 2)} />
                    <span className="ml-1 text-xs">USDC</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {isWalletLoaded ? (
        isWalletConnected ? (
          <WalletInfo />
        ) : (
          <ConnectWalletButton className="w-full md:w-auto" />
        )
      ) : (
        <div className="pl-2 pr-2">
          <Spinner size="small" />
        </div>
      )}
    </>
  );
}
