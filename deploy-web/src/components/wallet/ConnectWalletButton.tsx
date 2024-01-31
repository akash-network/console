"use client";
import React, { ReactNode } from "react";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { Button, ButtonProps } from "../ui/button";
import { Wallet } from "iconoir-react";

interface Props extends ButtonProps {
  children?: ReactNode;
  className?: string;
}

export const ConnectWalletButton: React.FunctionComponent<Props> = ({ className = "", ...rest }) => {
  const { connect } = useSelectedChain();

  return (
    <Button variant="outline" color="primary" onClick={() => connect()} className={className} {...rest}>
      <Wallet className="text-xs" />
      <span className="ml-2 whitespace-nowrap">Connect Wallet</span>
    </Button>
  );
};
