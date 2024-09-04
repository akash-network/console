"use client";
import React from "react";
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
import { Bank, CoinsSwap, HandCard, LogOut, MoreHoriz, Wallet } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ConnectManagedWalletButton } from "@src/components/wallet/ConnectManagedWalletButton";
import { envConfig } from "@src/config/env.config";
import { useWallet } from "@src/context/WalletProvider";
import { useLoginRequiredEventHandler } from "@src/hooks/useLoginRequiredEventHandler";
import { useTotalWalletBalance } from "@src/hooks/useWalletBalance";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { UrlService } from "@src/utils/urlUtils";
import { FormattedDecimal } from "../shared/FormattedDecimal";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";

const goToCheckout = () => {
  window.location.href = "/api/proxy/v1/checkout";
};

const withBilling = envConfig.NEXT_PUBLIC_BILLING_ENABLED;

export function WalletStatus() {
  const { walletName, address, walletBalances, logout, isWalletLoaded, isWalletConnected, isManaged, isWalletLoading, isTrialing, switchWalletType } =
    useWallet();
  const walletBalance = useTotalWalletBalance();
  const router = useRouter();
  const whenLoggedIn = useLoginRequiredEventHandler();

  const onAuthorizeSpendingClick = () => {
    router.push(UrlService.settingsAuthorizations());
  };

  return (
    <>
      {isWalletLoaded && !isWalletLoading ? (
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
                    {!isManaged && (
                      <>
                        <DropdownMenuItem onClick={() => onAuthorizeSpendingClick()}>
                          <Bank />
                          &nbsp;Authorize Spending
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={logout}>
                          <LogOut />
                          &nbsp;Disconnect Wallet
                        </DropdownMenuItem>
                        {withBilling && (
                          <DropdownMenuItem onClick={switchWalletType}>
                            <CoinsSwap />
                            &nbsp;Switch to USD billing
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    {withBilling && isManaged && (
                      <>
                        <DropdownMenuItem onClick={whenLoggedIn(goToCheckout, "Sign In or Sign Up to top up your balance")}>
                          <HandCard />
                          &nbsp;Top up balance
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={switchWalletType}>
                          <CoinsSwap />
                          &nbsp;Switch to wallet billing
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center text-left">
                <div className="flex items-center text-sm font-bold">
                  <Wallet className="text-xs" />
                  {isManaged && isTrialing && <p className="ml-2 text-primary">Trial</p>}
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
          <div>
            {withBilling && <ConnectManagedWalletButton className="mb-2 mr-2 w-full md:mb-0 md:w-auto" />}
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
