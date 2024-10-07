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
import { browserEnvConfig } from "@src/config/browser-env.config";
import { useWallet } from "@src/context/WalletProvider";
import { useLoginRequiredEventHandler } from "@src/hooks/useLoginRequiredEventHandler";
import { useManagedEscrowFaqModal } from "@src/hooks/useManagedEscrowFaqModal";
import { getSplitText } from "@src/hooks/useShortText";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { UrlService } from "@src/utils/urlUtils";
import { FormattedDecimal } from "../shared/FormattedDecimal";
import { LinkTo } from "../shared/LinkTo";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";

const goToCheckout = () => {
  window.location.href = "/api/proxy/v1/checkout";
};

const withBilling = browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED;

export function WalletStatus() {
  const { walletName, address, logout, isWalletLoaded, isWalletConnected, isManaged, isWalletLoading, isTrialing, switchWalletType } = useWallet();
  const { balance: walletBalance } = useWalletBalance();
  const router = useRouter();
  const whenLoggedIn = useLoginRequiredEventHandler();
  const { showManagedEscrowFaqModal } = useManagedEscrowFaqModal();

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
                          {walletName?.length > 20 ? (
                            <span className="text-xs">{getSplitText(walletName, 4, 4)}</span>
                          ) : (
                            <span className="text-xs">{walletName}</span>
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">{walletName}</div>
                          <Address address={address} isCopyable disableTooltip disableTruncate />
                        </TooltipContent>
                      </Tooltip>
                    </Link>
                  )}
                </div>

                {walletBalance && (
                  <div className="ml-2 flex items-center whitespace-nowrap font-bold text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge className="h-5 text-xs font-bold" variant="secondary">
                          <FormattedNumber
                            value={isManaged ? walletBalance.totalDeploymentGrantsUSD : walletBalance.totalUsd}
                            // eslint-disable-next-line react/style-prop-object
                            style="currency"
                            currency="USD"
                          />
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!isManaged ? (
                          <div className="text-base">
                            <div className="flex items-center justify-between space-x-2">
                              <span>
                                <FormattedDecimal value={uaktToAKT(walletBalance.totalUAKT, 2)} />
                              </span>
                              <span className="text-xs">AKT</span>
                            </div>
                            <div className="flex items-center justify-between space-x-2">
                              <span>
                                <FormattedDecimal value={udenomToDenom(walletBalance.totalUUSDC, 2)} />
                              </span>
                              <span className="text-xs">USDC</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between space-x-2">
                              <span className="text-xs text-muted-foreground">Available:</span>
                              <span>
                                <FormattedNumber
                                  value={walletBalance.totalDeploymentGrantsUSD}
                                  // eslint-disable-next-line react/style-prop-object
                                  style="currency"
                                  currency="USD"
                                />
                              </span>
                            </div>

                            <div className="flex items-center justify-between space-x-2">
                              <span className="text-xs text-muted-foreground">Deposits:</span>
                              <span>
                                <FormattedNumber
                                  value={walletBalance.totalDeploymentEscrowUSD}
                                  // eslint-disable-next-line react/style-prop-object
                                  style="currency"
                                  currency="USD"
                                />
                              </span>
                            </div>

                            <div>
                              <LinkTo className="text-xs italic" onClick={() => showManagedEscrowFaqModal()}>
                                What's this?
                              </LinkTo>
                            </div>
                          </div>
                        )}
                      </TooltipContent>
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
