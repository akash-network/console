"use client";
import "react-modern-drawer/dist/index.css";

import { useState } from "react";
import Drawer from "react-modern-drawer";
import { Button, DiscordLogo, GithubLogo, XLogo } from "@akashnetwork/ui/components";
import { ChartColumnIncreasing, Flame, Menu, Rocket, SquareArrowUpRight } from "lucide-react";
import dynamic from "next/dynamic";

import { AkashConsoleDarkLogo, AkashConsoleLightLogo } from "../icons/AkashConsoleLogo";
import { ModeToggle } from "../ModeToggle";
import { NavLinks } from "../NavLinks";

import { Link } from "@/components/Link/Link";
import useCookieTheme from "@/hooks/useTheme";

const NetworkSelect = dynamic(() => import("./NetworkSelect"), {
  ssr: false
});

export function MobileNav() {
  const theme = useCookieTheme();
  const [isOpen, setIsOpen] = useState(false);
  const toggleDrawer = () => {
    setIsOpen(prevState => !prevState);
  };

  return (
    <>
      <Button variant="ghost" className="text-md" onClick={() => toggleDrawer()}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </Button>

      <Drawer open={isOpen} onClose={toggleDrawer} direction="left" className="!bg-background p-4" customIdSuffix="mobile-drawer">
        {theme === "light" ? <AkashConsoleLightLogo className="h-[25px] w-full" /> : <AkashConsoleDarkLogo className="h-[25px] w-full" />}

        <div className="flex h-[100%] flex-col items-center justify-between pb-8 pt-4">
          <div className="mt-4 w-full">
            <NavLinks
              links={[
                {
                  title: "Deploy",
                  icon: <Rocket className="h-5 w-5 rotate-45" />,
                  variant: "default",
                  href: "https://console.akash.network",
                  isExternal: true,
                  rel: "noreferrer"
                },
                {
                  title: "Dashboard",
                  icon: <ChartColumnIncreasing className="h-5 w-5" />,
                  variant: "ghost",
                  href: "/"
                },
                {
                  title: "BME",
                  icon: <Flame className="h-5 w-5" />,
                  variant: "ghost",
                  href: "/bme"
                },
                {
                  title: "akash.network",
                  icon: <SquareArrowUpRight className="h-5 w-5" />,
                  variant: "ghost",
                  href: "https://akash.network",
                  isExternal: true,
                  rel: "noreferrer"
                }
              ]}
            />
          </div>
          <div>
            <div>
              <NetworkSelect />
            </div>

            <div className="flex items-center justify-center pt-4">
              <Link target="_blank" rel="noreferrer" href="https://twitter.com/akashnet" className="text-foreground">
                <Button variant="ghost" size="icon">
                  <XLogo width="1.2rem" height="1.2rem" />
                  <span className="sr-only">Twitter</span>
                </Button>
              </Link>

              <Link target="_blank" rel="noreferrer" href="https://github.com/akash-network/console" className="text-foreground">
                <Button variant="ghost" size="icon">
                  <GithubLogo width="1.2rem" height="1.2rem" />
                  <span className="sr-only">GitHub</span>
                </Button>
              </Link>

              <Link target="_blank" rel="noreferrer" href="https://discord.akash.network" className="text-foreground">
                <Button variant="ghost" size="icon">
                  <DiscordLogo width="1.2rem" height="1.2rem" />
                  <span className="sr-only">Twitter</span>
                </Button>
              </Link>

              <ModeToggle />
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
