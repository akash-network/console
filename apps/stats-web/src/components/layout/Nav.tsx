import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Button } from "@akashnetwork/ui/components";
import { Discord, Github, Rocket, X as TwitterX } from "iconoir-react";

import { AkashConsoleDarkLogo, AkashConsoleLightLogo } from "../icons/AkashConsoleLogo";
import { ModeToggle } from "../ModeToggle";
import { MobileNav } from "./MobileNav";
import { TopBanner } from "./TopBanner";

import { useTheme } from "@/hooks/useTheme";
import { useTopBanner } from "@/hooks/useTopBanner";

const NetworkSelect = lazy(() => import("./NetworkSelect"));

export const Nav = () => {
  const { theme } = useTheme();
  const { hasBanner } = useTopBanner();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-header backdrop-blur supports-[backdrop-filter]:bg-header">
      {hasBanner && (
        <div>
          <TopBanner />
        </div>
      )}

      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          {!!theme && (
            <Link className="flex items-center space-x-2" to="/">
              {theme === "light" ? <AkashConsoleLightLogo className="h-[25px] max-w-[180px]" /> : <AkashConsoleDarkLogo className="h-[25px] max-w-[180px]" />}
            </Link>
          )}

          <div className="ml-8 hidden md:flex">
            <Suspense fallback={null}>
              <NetworkSelect />
            </Suspense>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end">
          <div className="md:hidden">
            <MobileNav />
          </div>

          <nav className="hidden items-center md:flex">
            <a target="_blank" rel="noreferrer" href="https://twitter.com/akashnet" className="text-foreground">
              <Button variant="ghost" size="icon">
                <TwitterX width="1.2rem" height="1.2rem" />
                <span className="sr-only">Twitter</span>
              </Button>
            </a>

            <a target="_blank" rel="noreferrer" href="https://github.com/akash-network/console" className="text-foreground">
              <Button variant="ghost" size="icon">
                <Github width="1.2rem" height="1.2rem" />
                <span className="sr-only">GitHub</span>
              </Button>
            </a>

            <a target="_blank" rel="noreferrer" href="https://discord.akash.network" className="text-foreground">
              <Button variant="ghost" size="icon">
                <Discord width="1.2rem" height="1.2rem" />
                <span className="sr-only">Discord</span>
              </Button>
            </a>

            <ModeToggle />

            <a rel="noreferrer" href="https://akash.network" target="_blank" className="ml-4 text-foreground">
              <Button variant="outline" size="sm" className="h-[30px]">
                akash.network
              </Button>
            </a>

            <a rel="noreferrer" href="https://console.akash.network" target="_blank" className="ml-4">
              <Button variant="default" size="sm" className="h-[30px]">
                Deploy
                <Rocket className="ml-2 rotate-45" />
              </Button>
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
};
