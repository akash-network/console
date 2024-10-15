"use client";
import React, { ReactNode } from "react";
import { Button, ButtonProps } from "@akashnetwork/ui/components";
import { Wallet } from "iconoir-react";

import { useSelectedChain } from "@src/context/CustomChainProvider";
import { cn } from "@akashnetwork/ui/utils";

interface Props extends ButtonProps {
  children?: ReactNode;
  className?: string;
}

export const ConnectWalletButton: React.FunctionComponent<Props> = ({ className = "", ...rest }) => {
  const { connect } = useSelectedChain();

  return (
    <Button variant="outline" onClick={() => connect()} className={className} {...rest} data-testid="connect-wallet-btn">
      <Wallet className="text-xs" />
      <span className="ml-2 whitespace-nowrap">Connect Wallet</span>
    </Button>
  );
};
