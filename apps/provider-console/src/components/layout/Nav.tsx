"use client";
import { Menu, Xmark } from "iconoir-react";
import Link from "next/link";
import useCookieTheme from "@src/hooks/useTheme";
import { accountBarHeight } from "@src/utils/constants";
import { UrlService } from "@src/utils/urlUtils";
import { AkashConsoleBetaLogoDark, AkashConsoleBetaLogoLight } from "../icons/AkashConsoleLogo";
import { Button } from "@akashnetwork/ui/components";

export const Nav = ({
  isMobileOpen,
  handleDrawerToggle
}: React.PropsWithChildren<{
  isMobileOpen: boolean;
  handleDrawerToggle: () => void;
}>) => {
  const theme = useCookieTheme();

  return (
    <header className="border-border bg-popover dark:bg-background fixed top-0 z-50 w-full border-b">
      <div className="flex h-14 items-center justify-between pl-4 pr-4">
        {!!theme && (
          <Link className="flex items-center" href="/">
            {theme === "light" ? (
              <AkashConsoleBetaLogoLight className="h-[19px] max-w-[200px]" />
            ) : (
              <AkashConsoleBetaLogoDark className="h-[19px] max-w-[200px]" />
            )}
          </Link>
        )}

        <div style={{ height: `${accountBarHeight}px` }} className={`hidden items-center md:flex`}>
          <div>
            <Link passHref href={UrlService.getStarted()}>
              <Button variant="outline" className="relative">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

