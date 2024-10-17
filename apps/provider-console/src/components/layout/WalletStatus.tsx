"use client";
import { useEffect } from "react";
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
import { useChainWallet } from "@cosmos-kit/react";
import { LogOut, MoreHoriz, Wallet } from "iconoir-react";
import Link from "next/link";

import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useTotalWalletBalance } from "@src/hooks/useWalletBalance";
import authClient from "@src/utils/authClient";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { FormattedDecimal } from "../shared/FormattedDecimal";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";

const DEV_URL = "app-dev.praetor.dev";

export function WalletStatus() {
  const { walletName, address, walletBalances, logout, isWalletLoaded, isWalletConnected } = useWallet();
  const { wallet } = useSelectedChain();
  const walletBalance = useTotalWalletBalance();

  const { signArbitrary: keplrSignArbitrary } = useChainWallet("akash", "keplr-extension");
  const { signArbitrary: leapSignArbitrary } = useChainWallet("akash", "leap-extension");

  const getNonceMessage = (nonce: string) => {
    const url = process.env.NODE_ENV === "development" ? DEV_URL : window.location.hostname;
    return `${url} wants you to sign in with your Keplr account - ${address} using Nonce - ${nonce}`;
  };

  const handleWalletConnectSuccess = async () => {
    if (!localStorage.getItem("accessToken")) {
      const response: any = await authClient.get(`users/nonce/${address}`);
      if (response?.data?.nonce) {
        const message = getNonceMessage(response.data.nonce);
        const signArbitrary = wallet?.name === "leap-extension" ? leapSignArbitrary : keplrSignArbitrary;
        try {
          const result = await signArbitrary(address, message);

          if (result) {
            const verifySign = await authClient.post("auth/verify", { signer: address, ...result });
            if (verifySign.data) {
              localStorage.setItem("accessToken", verifySign.data.access_token);
              localStorage.setItem("refreshToken", verifySign.data.refresh_token);
              localStorage.setItem("walletAddress", address);
            } else {
              logout();
            }
          } else {
            logout();
          }
        } catch (error) {
          logout();
        }
      } else {
        if (response.status === 404 && response.error.code === "N4040") {
          authClient.post("users", { address });
          handleWalletConnectSuccess();
        }
      }
    }
  };

  useEffect(() => {
    if (isWalletConnected && address) {
      handleWalletConnectSuccess();
    } else if (!isWalletConnected) {
      console.log("Wallet disconnected");
    }
  }, [isWalletConnected, address]);

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
