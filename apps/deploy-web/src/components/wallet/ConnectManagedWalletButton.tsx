"use client";
import React, { ReactNode } from "react";
import { Button, ButtonProps, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Rocket } from "iconoir-react";

import { useWallet } from "@src/context/WalletProvider";

interface Props extends ButtonProps {
  children?: ReactNode;
  className?: string;
}

export const ConnectManagedWalletButton: React.FunctionComponent<Props> = ({ className = "", ...rest }) => {
  const { connectManagedWallet, hasManagedWallet, isWalletLoading } = useWallet();

  return (
    <Button
      variant="outline"
      onClick={connectManagedWallet}
      className={cn("border-primary bg-primary/10 dark:bg-primary", className)}
      {...rest}
      disabled={isWalletLoading}
    >
      {isWalletLoading ? <Spinner size="small" className="mr-2" variant="dark" /> : <Rocket className="rotate-45 text-xs" />}
      <span className="m-2 whitespace-nowrap">{hasManagedWallet ? "Switch to USD Payments" : "Start Trial"}</span>
    </Button>
  );
};
