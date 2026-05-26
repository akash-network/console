"use client";
import React from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { LogIn } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { useIsSelfCustodyEnabled } from "@src/hooks/useIsSelfCustodyEnabled";
import walletStore from "@src/store/walletStore";
import { UrlService } from "@src/utils/urlUtils";
import { ConnectManagedWalletButton } from "./ConnectManagedWalletButton";
import { ConnectWalletButton } from "./ConnectWalletButton";

interface WalletConnectionButtonsProps {
  className?: string;
  connectManagedWalletButtonClassName?: string;
  connectWalletButtonClassName?: string;
  dependencies?: typeof DEPENDENCIES;
}

export const DEPENDENCIES = {
  useIsSelfCustodyEnabled,
  useCustomUser,
  ConnectManagedWalletButton,
  ConnectWalletButton
};

export const WalletConnectionButtons: React.FC<WalletConnectionButtonsProps> = ({
  className,
  connectManagedWalletButtonClassName,
  connectWalletButtonClassName,
  dependencies: d = DEPENDENCIES
}) => {
  const [isSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);
  const { user } = d.useCustomUser();
  const isSelfCustodyEnabled = d.useIsSelfCustodyEnabled();

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {!isSignedInWithTrial && <d.ConnectManagedWalletButton className={connectManagedWalletButtonClassName} />}
      {isSignedInWithTrial && !user && (
        <Link className={cn(buttonVariants({ variant: "outline" }), "flex items-center gap-2")} href={UrlService.newLogin()} passHref prefetch={false}>
          <LogIn className="text-xs" />
          Sign in
        </Link>
      )}
      {isSelfCustodyEnabled && <d.ConnectWalletButton className={connectWalletButtonClassName} />}
    </div>
  );
};
