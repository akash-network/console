"use client";
import type { ReactNode } from "react";
import React from "react";
import type { ButtonProps } from "@akashnetwork/ui/components";
import { Button } from "@akashnetwork/ui/components";
import { Wallet } from "iconoir-react";

import { useWallet } from "@src/context/WalletProvider";
import { cn } from "@src/utils/styleUtils";

interface Props extends ButtonProps {
  children?: ReactNode;
  className?: string;
}

export const ConnectWalletButton: React.FC<Props> = ({ className = "", ...rest }) => {
  const { connectWallet } = useWallet();
  return (
    <Button variant="outline" onClick={connectWallet} className={cn("border-primary", className)} {...rest} data-testid="connect-wallet-btn">
      <Wallet className="text-xs" />
      <span className="ml-2 whitespace-nowrap">Connect Wallet</span>
    </Button>
  );
};
