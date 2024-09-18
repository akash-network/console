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
import { useChainWallet, useWalletClient } from "@cosmos-kit/react";
import { Bank, LogOut, MoreHoriz, Wallet } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useTotalWalletBalance } from "@src/hooks/useWalletBalance";
import authClient from "@src/utils/authClient";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { FormattedDecimal } from "../shared/FormattedDecimal";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
// import { jwtDecode } from "jwt-decode";

export function WalletStatus() {
  const { walletName, address, walletBalances, logout, isWalletLoaded, isWalletConnected } = useWallet();
  const { wallet } = useSelectedChain();

  const walletBalance = useTotalWalletBalance();
  const router = useRouter();

  const { signArbitrary: keplrSignArbitrary } = useChainWallet("akash", "keplr-extension");
  const { signArbitrary: leapSignArbitrary } = useChainWallet("akash", "leap-extension");

  // Define your custom function to call on successful connection
  const onWalletConnectSuccess = async () => {
    console.log("Attempting wallet connection...");
    if (!localStorage.getItem("accessToken")) {
      console.log("No access token found, initiating authentication process");
      // Get Nonce
      const response = await authClient.get(`users/nonce/${address}`);
      if (response.data.nonce) {
        console.log("Nonce received:", response.data.nonce);
        // Get Address
        let url: string;
        if (process.env.NODE_ENV === "development") {
          url = "app-dev.praetor.dev";
        } else {
          url = window.location.hostname;
        }
        console.log(wallet);

        const message = `${url} wants you to sign in with your Keplr account - ${address} using Nonce - ${response.data.nonce}`;
        console.log("Signing message with wallet:", wallet?.name);
        let result;
        if (wallet?.name == "leap-extension") {
          result = await leapSignArbitrary(address, message);
        } else {
          result = await keplrSignArbitrary(address, message);
        }

        console.log("Signature result:", result);
        if (result) {
          console.log("Verifying signature with server");
          const verifySign = await authClient.post("auth/verify", { signer: address, ...result });
          if (verifySign.data) {
            console.log("Authentication successful, storing tokens");
            localStorage.setItem("accessToken", verifySign.data.access_token);
            localStorage.setItem("refreshToken", verifySign.data.refresh_token);
          } else {
            console.error("Error in signature verification");
            logout();
          }
        }
      }
    } else {
      console.log("Access Token found, skipping authentication process");
      // TODO Probably more work needs to be done for refresh token

      console.log("Access Token Found");
      // const decodedJwt: any = jwtDecode(localStorage.getItem("accessToken"));

      // if (decodedJwt.exp < Math.floor(Date.now() / 1000)) {
      //   // renew with access token
      //   // TODO renew access token logic here
      // }
    }
  };

  useEffect(() => {
    console.log("WalletStatus: Wallet connection status changed:", isWalletConnected);
    if (isWalletConnected && address) {
      onWalletConnectSuccess();
    } else if (!isWalletConnected) {
      console.log("Wallet disconnected");
    }
  }, [isWalletConnected, address]);

  function onDisconnectClick() {
    console.log("Disconnecting wallet");
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
