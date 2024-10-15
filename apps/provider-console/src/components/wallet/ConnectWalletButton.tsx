"use client";
import React, { ReactNode, useEffect } from "react";
import { Button, ButtonProps } from "@akashnetwork/ui/components";
import { Wallet } from "iconoir-react";

import { useSelectedChain } from "@src/context/CustomChainProvider";
import { cn } from "@src/utils/styleUtils";
import { useWallet } from "@src/context/WalletProvider";

interface Props extends ButtonProps {
  children?: ReactNode;
  className?: string;
}

export const ConnectWalletButton: React.FunctionComponent<Props> = ({ className = "", ...rest }) => {
  const { status, isWalletConnected, address } = useSelectedChain();
  const { connectWallet } = useWallet();

  // Define your custom function to call on successful connection
  const onWalletConnectSuccess = () => {
    console.log("Wallet connected successfully!", address);
    // Add any other logic you want to execute upon successful connection
  };

  // Use useEffect to monitor the connection status
  useEffect(() => {
    console.log(isWalletConnected, address);
    if (status === "Connected") {
      onWalletConnectSuccess();
    }
  }, [status, address]); // Ensure to include address as a dependency if needed

  return (
    <Button variant="outline" onClick={connectWallet} className={cn("border-primary", className)} {...rest} data-testid="connect-wallet-btn">
      <Wallet className="text-xs" />
      <span className="ml-2 whitespace-nowrap">Connect Wallet</span>
    </Button>
  );
};
