"use client";
import { AkashConsoleDarkLogo, AkashConsoleLightLogo } from "../icons/AkashConsoleLogo";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { Button } from "../ui/button";
import useCookieTheme from "@src/hooks/useTheme";
import { accountBarHeight } from "@src/utils/constants";
import { Badge } from "../ui/badge";
import { WalletStatus } from "./WalletStatus";
import { AccountMenu } from "./AccountMenu";

export const Nav = () => {
  const theme = useCookieTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-popover">
      <div className="flex h-14 items-center justify-between pl-4 pr-4">
        <Link className="flex items-center space-x-2" href="/">
          {theme === "light" ? <AkashConsoleLightLogo className="h-[25px] max-w-[180px]" /> : <AkashConsoleDarkLogo className="h-[25px] max-w-[180px]" />}
        </Link>

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
