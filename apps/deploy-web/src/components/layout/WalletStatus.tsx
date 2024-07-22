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

import { ConnectManagedWalletButton } from "@src/components/wallet/ConnectManagedWalletButton";
import { envConfig } from "@src/config/env.config";
import { useWallet } from "@src/context/WalletProvider";
import { useTotalWalletBalance } from "@src/hooks/useWalletBalance";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { UrlService } from "@src/utils/urlUtils";
import { FormattedDecimal } from "../shared/FormattedDecimal";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";

export function WalletStatus() {
  const { walletName, address, walletBalances, logout, isWalletLoaded, isWalletConnected, isManaged, isWalletLoading } = useWallet();
  const walletBalance = useTotalWalletBalance();
  const router = useRouter();
  function onDisconnectClick() {
    logout();
  }

  const onAuthorizeSpendingClick = () => {
    router.push(UrlService.settingsAuthorizations());
  };

  return (
    <>
      {isWalletLoaded && !isWalletLoading ? (
        isWalletConnected ? (
          <>
            <div className="flex items-center pr-2">
              {!isManaged && (
                <div className="pl-2 pr-2">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHoriz />
                        <span className="sr-only">Toggle theme</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onAuthorizeSpendingClick()}>
                        <Bank />
                        &nbsp;Authorize Spending
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDisconnectClick()}>
                        <LogOut />
                        &nbsp;Disconnect Wallet
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              <div className="flex items-center text-left">
                <div className="flex items-center text-sm font-bold">
                  <Wallet className="text-xs" />
                  {!isManaged && (
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
                  )}
                </div>

                {walletBalances && (
                  <div className="ml-2 flex items-center whitespace-nowrap font-bold text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger disabled={isManaged}>
                        <Badge className="h-5 text-xs font-bold" variant="secondary">
                          <FormattedNumber
                            value={walletBalance}
                            // eslint-disable-next-line react/style-prop-object
                            style="currency"
                            currency="USD"
                          />
                        </Badge>
                      </TooltipTrigger>
                      {!isManaged && (
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
                      )}
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <ConnectWalletButton className="w-full md:w-auto" />
            {envConfig.NEXT_PUBLIC_BILLING_ENABLED && <ConnectManagedWalletButton className="ml-2 w-full md:w-auto" />}
          </>
        )
      ) : (
        <div className="pl-2 pr-2">
          <Spinner size="small" />
        </div>
      )}
    </>
  );
}
