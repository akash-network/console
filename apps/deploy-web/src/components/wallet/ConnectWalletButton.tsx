"use client";
import type { ReactNode } from "react";
import React from "react";
import type { ButtonProps } from "@akashnetwork/ui/components";
import { Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Wallet } from "iconoir-react";

import { useSelectedChain } from "@src/context/CustomChainProvider";

interface Props extends ButtonProps {
  children?: ReactNode;
  className?: string;
}

export const ConnectWalletButton: React.FunctionComponent<Props> = ({ className = "", ...rest }) => {
  const { connect } = useSelectedChain();

  return (
    <Button
      variant="outline"
      onClick={() => connect()}
      className={cn("flex items-center gap-2 whitespace-nowrap", className)}
      {...rest}
      data-testid="connect-wallet-btn"
    >
      <Wallet className="text-xs" />
      <span>Connect Wallet</span>
    </Button>
  );
};
