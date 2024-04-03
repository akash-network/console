"use client";
import { useWallet } from "@src/context/WalletProvider";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { FormattedDecimal } from "../shared/FormattedDecimal";
import { Address } from "../shared/Address";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { FormattedNumber } from "react-intl";
import { useTotalWalletBalance } from "@src/hooks/useWalletBalance";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { MoreHoriz, Wallet, Bank, LogOut } from "iconoir-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Badge } from "../ui/badge";
import Spinner from "../shared/Spinner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

export function WalletStatus({}: React.PropsWithChildren<{}>) {
  const { walletName, address, walletBalances, logout, isWalletLoaded, isWalletConnected } = useWallet();
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

              <div className="flex items-center text-left">
                <div className="flex items-center text-sm font-bold">
                  <Wallet className="text-sm" />
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
