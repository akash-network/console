"use client";
import { Button } from "@akashnetwork/ui/components";
import { cn, REMOVE_SCROLL_CLASS_NAMES } from "@akashnetwork/ui/utils";
import type { ClassValue } from "clsx";
import { Menu, Xmark } from "iconoir-react";
import Link from "next/link";

import { ACCOUNT_BAR_HEIGHT } from "@src/config/ui.config";
import useCookieTheme from "@src/hooks/useTheme";
import { AccountMenu } from "./AccountMenu";
import { AkashLogo } from "./AkashLogo";
import { WalletStatus } from "./WalletStatus";

export const Nav = ({
  isMobileOpen,
  handleDrawerToggle,
  className,
  minimal = false
}: React.PropsWithChildren<{
  isMobileOpen: boolean;
  handleDrawerToggle: () => void;
  className?: ClassValue;
  minimal?: boolean;
}>) => {
  const theme = useCookieTheme();

  return (
    <header className={cn("fixed left-0 right-0 top-0 z-50 border-b border-border bg-header", className, REMOVE_SCROLL_CLASS_NAMES.zeroRight)}>
      <div className="flex h-14 items-center justify-between pl-4 pr-4">
        {!!theme && (
          <Link className="flex items-center" href="/">
            <AkashLogo />
          </Link>
        )}

        {!minimal && (
          <div>
            <Button size="icon" className="rounded-full md:hidden" variant="ghost" onClick={handleDrawerToggle}>
              {isMobileOpen ? <Xmark /> : <Menu />}
            </Button>
          </div>
        )}

        {minimal ? (
          // Onboarding: no sidebar drawer, so the reduced menu is the only logout path and must show on mobile too.
          <div style={{ height: `${ACCOUNT_BAR_HEIGHT}px` }} className="flex items-center">
            <AccountMenu minimal />
          </div>
        ) : (
          <div style={{ height: `${ACCOUNT_BAR_HEIGHT}px` }} className="hidden items-center md:flex">
            <div className="flex items-center gap-2">
              <div className="ml-4 flex items-center gap-2">
                <WalletStatus />
              </div>

              <AccountMenu />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
