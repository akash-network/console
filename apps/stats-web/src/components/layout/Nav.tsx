"use client";
import { Discord, Github, Rocket, X as TwitterX } from "iconoir-react";
import Link from "next/link";

import { AkashConsoleDarkLogo, AkashConsoleLightLogo } from "../icons/AkashConsoleLogo";
import { ModeToggle } from "../ModeToggle";
import { Button } from "@akashnetwork/ui/components";
import { MobileNav } from "./MobileNav";
import NetworkSelect from "./NetworkSelect";

import useCookieTheme from "@/hooks/useTheme";

export const Nav = () => {
  const theme = useCookieTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background backdrop-blur supports-[backdrop-filter]:bg-background">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          {!!theme && (
            <Link className="flex items-center space-x-2" href="/">
              {theme === "light" ? <AkashConsoleLightLogo className="h-[25px] max-w-[180px]" /> : <AkashConsoleDarkLogo className="h-[25px] max-w-[180px]" />}
            </Link>
          )}

          <div className="ml-8 hidden md:flex">
            <NetworkSelect />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end">
          <div className="md:hidden">
            <MobileNav />
          </div>

          <nav className="hidden items-center md:flex">
            <Link target="_blank" rel="noreferrer" href="https://twitter.com/akashnet_" className="text-foreground">
              <Button variant="ghost" size="icon">
                <TwitterX width="1.2rem" height="1.2rem" />
                <span className="sr-only">Twitter</span>
              </Button>
            </Link>

            <Link target="_blank" rel="noreferrer" href="https://github.com/akash-network/cloudmos" className="text-foreground">
              <Button variant="ghost" size="icon">
                <Github width="1.2rem" height="1.2rem" />
                <span className="sr-only">GitHub</span>
              </Button>
            </Link>

            <Link target="_blank" rel="noreferrer" href="https://discord.akash.network" className="text-foreground">
              <Button variant="ghost" size="icon">
                <Discord width="1.2rem" height="1.2rem" />
                <span className="sr-only">Twitter</span>
              </Button>
            </Link>

            <ModeToggle />

            <Link rel="noreferrer" href="https://akash.network" passHref target="_blank" className="ml-4 text-foreground">
              <Button variant="outline" size="sm" className="h-[30px]">
                akash.network
              </Button>
            </Link>

            <Link rel="noreferrer" href="https://console.akash.network" passHref target="_blank" className="ml-4">
              <Button variant="default" size="sm" className="h-[30px]">
                Deploy
                <Rocket className="ml-2 rotate-45" />
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};
