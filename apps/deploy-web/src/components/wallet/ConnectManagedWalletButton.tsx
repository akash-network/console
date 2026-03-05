"use client";
import type { ReactNode } from "react";
import React, { useCallback } from "react";
import type { ButtonProps } from "@akashnetwork/ui/components";
import { Button, Spinner } from "@akashnetwork/ui/components";
import { Rocket } from "iconoir-react";
import { useRouter } from "next/navigation";

import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { UrlService } from "@src/utils/urlUtils";

const DEPENDENCIES = {
  useFlag,
  useRouter,
  useSettings
};

interface Props extends ButtonProps {
  children?: ReactNode;
  className?: string;
  dependencies?: typeof DEPENDENCIES;
}

export const ConnectManagedWalletButton: React.FunctionComponent<Props> = ({ className = "", dependencies: d = DEPENDENCIES, ...rest }) => {
  const { settings } = d.useSettings();
  const { hasManagedWallet, isWalletLoading, switchWalletType } = useWallet();
  const router = d.useRouter();

  const handleClick: React.MouseEventHandler = useCallback(() => {
    if (hasManagedWallet) {
      switchWalletType();
    } else {
      router.push(UrlService.onboarding());
    }
  }, [hasManagedWallet, switchWalletType, router]);

  return (
    <Button variant="default" onClick={handleClick} className={className} {...rest} disabled={settings.isBlockchainDown || isWalletLoading}>
      {isWalletLoading ? <Spinner size="small" className="mr-2" variant="dark" /> : <Rocket className="rotate-45 text-xs" />}
      <span className="m-2 whitespace-nowrap">{hasManagedWallet ? "Switch to USD Payments" : "Start Trial"}</span>
    </Button>
  );
};
