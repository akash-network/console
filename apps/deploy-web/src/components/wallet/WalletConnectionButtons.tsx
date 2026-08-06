"use client";
import React from "react";
import { cn } from "@akashnetwork/ui/utils";

import { ConnectManagedWalletButton } from "./ConnectManagedWalletButton";

interface WalletConnectionButtonsProps {
  className?: string;
  connectManagedWalletButtonClassName?: string;
  dependencies?: typeof DEPENDENCIES;
}

export const DEPENDENCIES = {
  ConnectManagedWalletButton
};

export const WalletConnectionButtons: React.FC<WalletConnectionButtonsProps> = ({
  className,
  connectManagedWalletButtonClassName,
  dependencies: d = DEPENDENCIES
}) => {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <d.ConnectManagedWalletButton className={connectManagedWalletButtonClassName} />
    </div>
  );
};
