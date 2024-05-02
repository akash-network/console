"use client";
import { AkashConsoleBetaLogoDark, AkashConsoleBetaLogoLight } from "../icons/AkashConsoleLogo";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { Button } from "../ui/button";
import useCookieTheme from "@src/hooks/useTheme";
import { accountBarHeight } from "@src/utils/constants";
import { Badge } from "../ui/badge";
import { WalletStatus } from "./WalletStatus";
import { AccountMenu } from "./AccountMenu";
import { Menu, Xmark } from "iconoir-react";

export const Nav = ({
  isMobileOpen,
  handleDrawerToggle
}: React.PropsWithChildren<{
  isMobileOpen: boolean;
  handleDrawerToggle: () => void;
}>) => {
  const theme = useCookieTheme();

  return (
    <header className="fixed top-0 z-50 w-full border-b border-border bg-popover dark:bg-background">
      <div className="flex h-14 items-center justify-between pl-4 pr-4">
        <Link className="flex items-center" href="/">
          {theme === "light" ? (
            <AkashConsoleBetaLogoLight className="h-[19px] max-w-[200px]" />
          ) : (
            <AkashConsoleBetaLogoDark className="h-[19px] max-w-[200px]" />
          )}
        </Link>

        <div>
          <Button size="icon" className="rounded-full md:hidden" variant="ghost" onClick={handleDrawerToggle}>
            {isMobileOpen ? <Xmark /> : <Menu />}
          </Button>
        </div>

        <div style={{ height: `${accountBarHeight}px` }} className={`hidden items-center md:flex `}>
          <div>
            <Link passHref href={UrlService.getStarted()}>
              <Button variant="outline" className="relative">
                Get Started
                <Badge className="absolute -right-1 -top-1 h-2 w-2 rounded-full p-0" />
              </Button>
            </Link>
          </div>

          <div className="flex items-center">
            <div className="ml-4">
              <WalletStatus />
            </div>

            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  );
};
