"use client";
import { Button, buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { ClassValue } from "clsx";
import { Menu, Xmark } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";

import { ACCOUNT_BAR_HEIGHT } from "@src/config/ui.config";
import { useCustomUser } from "@src/hooks/useCustomUser";
import useCookieTheme from "@src/hooks/useTheme";
import walletStore from "@src/store/walletStore";
import { UrlService } from "@src/utils/urlUtils";
import { AccountMenu } from "./AccountMenu";
import { AkashLogo } from "./AkashLogo";
import { WalletStatus } from "./WalletStatus";

export const Nav = ({
  isMobileOpen,
  handleDrawerToggle,
  className
}: React.PropsWithChildren<{
  isMobileOpen: boolean;
  handleDrawerToggle: () => void;
  className?: ClassValue;
}>) => {
  const theme = useCookieTheme();
  const [isSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);
  const { user } = useCustomUser();

  return (
    <header className={cn("fixed top-0 z-50 w-full border-b border-border bg-popover dark:bg-background", className)}>
      <div className="flex h-14 items-center justify-between pl-4 pr-4">
        {!!theme && (
          <Link className="flex items-center" href="/">
            <AkashLogo />
          </Link>
        )}

        <div>
          <Button size="icon" className="rounded-full md:hidden" variant="ghost" onClick={handleDrawerToggle}>
            {isMobileOpen ? <Xmark /> : <Menu />}
          </Button>
        </div>

        <div style={{ height: `${ACCOUNT_BAR_HEIGHT}px` }} className={`hidden items-center md:flex`}>
          <div>
            <Link passHref href={UrlService.getStarted()}>
              <Button variant="text" className="relative text-xs text-foreground">
                Get Started
              </Button>
            </Link>
          </div>

          <div className="flex items-center">
            <div className="ml-4 flex items-center gap-2">
              <WalletStatus />

              {isSignedInWithTrial && !user && (
                <Link className={cn(buttonVariants({ variant: "outline" }))} href={UrlService.login()}>
                  Sign in
                </Link>
              )}
            </div>

            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  );
};
