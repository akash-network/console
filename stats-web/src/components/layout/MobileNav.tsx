import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FaBars, FaGithub, FaXTwitter } from "react-icons/fa6";
import Drawer from "react-modern-drawer";
import { AkashConsoleDarkLogo, AkashConsoleLightLogo } from "../icons/AkashConsoleLogo";
import "react-modern-drawer/dist/index.css";
import useCookieTheme from "@/hooks/useTheme";
import NetworkSelect from "./NetworkSelect";
import { ModeToggle } from "../ModeToggle";
import { NavLinks } from "../NavLinks";
import { Rocket, LayoutDashboardIcon, ExternalLink } from "lucide-react";

export function MobileNav() {
  const theme = useCookieTheme();
  const [isOpen, setIsOpen] = useState(false);
  const toggleDrawer = () => {
    setIsOpen(prevState => !prevState);
  };

  return (
    <>
      <Button variant="ghost" className="text-xl" onClick={() => toggleDrawer()}>
        <FaBars />
        <span className="sr-only">Toggle Menu</span>
      </Button>

      <Drawer open={isOpen} onClose={toggleDrawer} direction="left" className="!bg-background p-4">
        {theme === "light" ? <AkashConsoleLightLogo className="h-[25px] w-full" /> : <AkashConsoleDarkLogo className="h-[25px] w-full" />}

        <div className="flex h-[100%] flex-col items-center justify-between pb-4 pt-4">
          <div className="mt-4 w-full">
            <NavLinks
              links={[
                {
                  title: "Deploy",
                  icon: Rocket,
                  variant: "default",
                  href: "https://deploy.cloudmos.io",
                  isExternal: true
                },
                {
                  title: "Dashboard",
                  icon: LayoutDashboardIcon,
                  variant: "ghost",
                  href: "/"
                },
                {
                  title: "Visit website",
                  icon: ExternalLink,
                  variant: "ghost",
                  href: "https://akash.network",
                  isExternal: true
                }
              ]}
            />
          </div>
          <div>
            <div>
              <NetworkSelect />
            </div>

            <div className="flex items-center justify-center pt-4">
              <a target="_blank" rel="noreferrer" href="https://github.com/akash-network/cloudmos">
                <Button variant="ghost" size="icon" className="text-md">
                  <FaGithub />
                  <span className="sr-only">GitHub</span>
                </Button>
              </a>
              <a target="_blank" rel="noreferrer" href="https://twitter.com/akashnet_">
                <Button variant="ghost" size="icon" className="text-md">
                  <FaXTwitter />
                  <span className="sr-only">Twitter</span>
                </Button>
              </a>

              <ModeToggle />
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
