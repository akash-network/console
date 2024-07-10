"use client";
import React, { ReactNode } from "react";
import { Button, ButtonProps } from "@akashnetwork/ui/components";
import { Wallet } from "iconoir-react";

import { useWallet } from "@src/context/WalletProvider";
import { cn } from "@src/utils/styleUtils";

interface Props extends ButtonProps {
  children?: ReactNode;
  className?: string;
}

export const ConnectManagedWalletButton: React.FunctionComponent<Props> = ({ className = "", ...rest }) => {
  const { connectManagedWallet } = useWallet();

  return (
    <Button variant="outline" onClick={connectManagedWallet} className={cn("border-primary", className)} {...rest}>
      <Wallet className="text-xs" />
      <span className="ml-2 whitespace-nowrap">Setup Billing</span>
    </Button>
  );
};
