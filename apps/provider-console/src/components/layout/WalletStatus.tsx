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
import { Bank, LogOut, MoreHoriz, Wallet } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useWallet } from "@src/context/WalletProvider";
import { useTotalWalletBalance } from "@src/hooks/useWalletBalance";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { FormattedDecimal } from "../shared/FormattedDecimal";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { useEffect } from "react";

export function WalletStatus() {
  const { walletName, address, walletBalances, logout, isWalletLoaded, isWalletConnected } = useWallet();
  const walletBalance = useTotalWalletBalance();
  const router = useRouter();

  // Define your custom function to call on successful connection
  const onWalletConnectSuccess = () => {
    console.log("Wallet connected successfully!", address);
    // Add any other logic you want to execute upon successful connection
  };

  useEffect(() => {
    if (isWalletConnected) {
      onWalletConnectSuccess();
    } else {
      console.log("Disconnected");
    }
  }, [isWalletConnected]); // Ensure to include address as a dependency if needed

  function onDisconnectClick() {
    logout();
  }

  return (
    <>
      {isWalletLoaded ? (
        isWalletConnected ? (
          <>
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
                    <DropdownMenuItem onClick={() => onDisconnectClick()}>
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
                            // eslint-disable-next-line react/style-prop-object
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
          </>
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
