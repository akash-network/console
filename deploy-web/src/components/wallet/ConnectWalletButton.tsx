"use client";
import React, { ReactNode } from "react";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { Button, ButtonProps } from "../ui/button";
import { Wallet } from "iconoir-react";
import { cn } from "@src/utils/styleUtils";

interface Props extends ButtonProps {
  children?: ReactNode;
  className?: string;
}

export const ConnectWalletButton: React.FunctionComponent<Props> = ({ className = "", ...rest }) => {
  const { connect } = useSelectedChain();

  return (
    <Button variant="outline" onClick={() => connect()} className={cn("border-primary", className)} {...rest}>
      <Wallet className="text-xs" />
      <span className="ml-2 whitespace-nowrap">Connect Wallet</span>
    </Button>
  );
};
