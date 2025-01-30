"use client";
import Link from "next/link";

import useCookieTheme from "@src/hooks/useTheme";
import { accountBarHeight } from "@src/utils/constants";
import { AkashConsoleLogoDark, AkashConsoleLogoLight } from "../icons/AkashConsoleLogo";
import { WalletStatus } from "./WalletStatus";

export const Nav = () => {
  const theme = useCookieTheme();

  return (
    <header className="border-border bg-popover dark:bg-background fixed top-0 z-50 w-full border-b">
      <div className="flex h-14 items-center justify-between pl-4 pr-4">
        {!!theme && (
          <Link className="flex items-center" href="/">
            {theme === "light" ? <AkashConsoleLogoLight className="h-[19px]" /> : <AkashConsoleLogoDark className="h-[19px]" />}
          </Link>
        )}

        <div style={{ height: `${accountBarHeight}px` }} className={`hidden items-center md:flex`}>
          <div className="flex items-center">
            <div className="ml-4">
              <WalletStatus />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
