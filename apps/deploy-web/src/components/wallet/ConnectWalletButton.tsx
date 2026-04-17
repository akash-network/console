"use client";
import { type ReactNode, useCallback, useState } from "react";
import type { ButtonProps } from "@akashnetwork/ui/components";
import { Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Wallet } from "iconoir-react";

import { useSelectedChain } from "@src/hooks/useSelectedChain/useSelectedChain";

interface Props extends ButtonProps {
  children?: ReactNode;
  className?: string;
}

export const ConnectWalletButton: React.FunctionComponent<Props> = ({ className = "", ...rest }) => {
  const { connect } = useSelectedChain();
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    try {
      await connect();
    } finally {
      setIsConnecting(false);
    }
  }, [connect, setIsConnecting]);

  return (
    <Button
      variant="outline"
      onClick={connectWallet}
      className={cn("flex items-center gap-2 whitespace-nowrap", isConnecting && "animate-pulse opacity-70", className)}
      {...rest}
      disabled={isConnecting}
      data-testid="connect-wallet-btn"
    >
      <Wallet className="text-xs" />
      <span>Connect Wallet</span>
    </Button>
  );
};
