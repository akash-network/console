"use client";
import { ModeToggle } from "../ModeToggle";
import { FaGithub, FaXTwitter } from "react-icons/fa6";
import { Button } from "../ui/button";
import { AkashConsoleDarkLogo, AkashConsoleLightLogo } from "../icons/AkashConsoleLogo";
import Link from "next/link";
import NetworkSelect from "./NetworkSelect";
import useCookieTheme from "@/hooks/useTheme";
import { MobileNav } from "./MobileNav";
import { NavigationMenu, NavigationMenuLink, NavigationMenuList, navigationMenuTriggerStyle } from "../ui/navigation-menu";

export const Nav = () => {
  const theme = useCookieTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link className="flex items-center space-x-2" href="/">
            {theme === "light" ? <AkashConsoleLightLogo className="h-[25px] max-w-[180px]" /> : <AkashConsoleDarkLogo className="h-[25px] max-w-[180px]" />}
          </Link>

          <NavigationMenu className="ml-10 hidden md:flex">
            <NavigationMenuList>
              <Link rel="noreferrer" href="https://deploy.cloudmos.io" passHref target="_blank">
                <NavigationMenuLink className={navigationMenuTriggerStyle()}>Deploy</NavigationMenuLink>
              </Link>

              <Link rel="noreferrer" href="https://akash.network" passHref target="_blank">
                <NavigationMenuLink className={navigationMenuTriggerStyle()}>Website</NavigationMenuLink>
              </Link>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex flex-1 items-center justify-end">
          <div className="md:hidden">
            <MobileNav />
          </div>

          <nav className="hidden items-center md:flex">
            <div className="mr-2">
              <NetworkSelect />
            </div>

            <a target="_blank" rel="noreferrer" href="https://github.com/akash-network/cloudmos">
              <Button variant="ghost" size="icon">
                <FaGithub />
                <span className="sr-only">GitHub</span>
              </Button>
            </a>
            <a target="_blank" rel="noreferrer" href="https://twitter.com/akashnet_">
              <Button variant="ghost" size="icon">
                <FaXTwitter />
                <span className="sr-only">Twitter</span>
              </Button>
            </a>

            <ModeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
};
