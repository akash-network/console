"use client";
import type { ReactNode } from "react";
import React, { useCallback } from "react";
import type { ButtonProps } from "@akashnetwork/ui/components";
import { Button, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Rocket } from "iconoir-react";

import { useWallet } from "@src/context/WalletProvider";
import { useLoginRequiredEventHandler } from "@src/hooks/useLoginRequiredEventHandler";
import { useFeatureFlags } from "@src/queries/featureFlags";

interface Props extends ButtonProps {
  children?: ReactNode;
  className?: string;
}

export const ConnectManagedWalletButton: React.FunctionComponent<Props> = ({ className = "", ...rest }) => {
  const { connectManagedWallet, hasManagedWallet, isWalletLoading } = useWallet();
  const { data: features } = useFeatureFlags();
  const whenLoggedIn = useLoginRequiredEventHandler();
  const startTrial: React.MouseEventHandler = useCallback(
    event => {
      if (features?.allowAnonymousUserTrial) {
        connectManagedWallet();
      } else {
        whenLoggedIn("Sign In or Sign Up to start trial")(connectManagedWallet)(event);
      }
    },
    [connectManagedWallet, features?.allowAnonymousUserTrial, whenLoggedIn]
  );

  return (
    <Button
      variant="outline"
      onClick={startTrial}
      className={cn("border-primary bg-primary/10 dark:bg-primary", className)}
      {...rest}
      disabled={isWalletLoading}
    >
      {isWalletLoading ? <Spinner size="small" className="mr-2" variant="dark" /> : <Rocket className="rotate-45 text-xs" />}
      <span className="m-2 whitespace-nowrap">{hasManagedWallet ? "Switch to USD Payments" : "Start Trial"}</span>
    </Button>
  );
};
