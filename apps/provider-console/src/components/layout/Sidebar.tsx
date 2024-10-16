"use client";
import React, { ReactNode, useState } from "react";
import { Button, buttonVariants } from "@akashnetwork/ui/components";
import Drawer from "@mui/material/Drawer";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Discord, Github, Menu, MenuScale, Rocket, X as TwitterX, Youtube, Cloud, Settings, ClipboardCheck, Calculator, ListSelect } from "iconoir-react";
import { Home, OpenInWindow } from "iconoir-react";
import getConfig from "next/config";
import Image from "next/image";
import Link from "next/link";

import { ISidebarGroupMenu } from "@src/types";
import { closedDrawerWidth, drawerWidth } from "@src/utils/constants";
import { cn } from "@src/utils/styleUtils";
import { UrlService } from "@src/utils/urlUtils";
import { ModeToggle } from "./ModeToggle";
import { SidebarGroupMenu } from "./SidebarGroupMenu";
import { useWallet } from "@src/context/WalletProvider";

const { publicRuntimeConfig } = getConfig();

type Props = {
  children?: ReactNode;
  isMobileOpen: boolean;
  handleDrawerToggle: () => void;
  onOpenMenuClick: () => void;
  isNavOpen: boolean;
};

export const Sidebar: React.FunctionComponent<Props> = ({ isMobileOpen, handleDrawerToggle, isNavOpen, onOpenMenuClick }) => {
  const [isHovering, setIsHovering] = useState(false);
  const { isProvider, isOnline } = useWallet();
  const _isNavOpen = isNavOpen || isHovering;
  // const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const muiTheme = useMuiTheme();
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));

  const routeGroups: ISidebarGroupMenu[] = [
    {
      hasDivider: false,
      routes: [
        {
          title: "Home",
          icon: props => <Home {...props} />,
          url: UrlService.home(),
          activeRoutes: [UrlService.home()]
        },
        {
          title: "Leases",
          icon: props => <Cloud {...props} />,
          url: "#",
          activeRoutes: ["#"],
          disabled: true
        },
        {
          title: "Actions",
          icon: props => <ClipboardCheck {...props} />,
          url: "#",
          activeRoutes: ["#"],
          disabled: true
        },
        {
          title: "Pricing",
          icon: props => <Calculator {...props} />,
          url: "#",
          activeRoutes: ["#"],
          disabled: true
        },
        {
          title: "Attributes",
          icon: props => <ListSelect {...props} />,
          url: "#",
          activeRoutes: ["#"],
          disabled: true
        },
        {
          title: "Settings",
          icon: props => <Settings {...props} />,
          url: "#",
          activeRoutes: ["#"],
          disabled: true
        }
      ]
    },
    {
      hasDivider: true,
      routes: [
        {
          title: "Akash Network",
          icon: props => <Image src="/images/akash-logo.svg" alt="Akash Logo" quality={100} width={20} height={20} {...props} />,
          url: "https://akash.network",
          activeRoutes: [],
          target: "_blank"
        },
        {
          title: "Stats",
          icon: props => <OpenInWindow {...props} />,
          url: "https://stats.akash.network",
          activeRoutes: [],
          target: "_blank"
        },
        {
          title: "Price Compare",
          icon: props => <OpenInWindow {...props} />,
          url: "https://akash.network/about/pricing/custom/",
          activeRoutes: [],
          target: "_blank"
        },
        {
          title: "API",
          icon: props => <OpenInWindow {...props} />,
          url: "https://console-api.akash.network/v1/swagger",
          activeRoutes: [],
          target: "_blank"
        },
        {
          title: "Docs",
          icon: props => <OpenInWindow {...props} />,
          url: "https://akash.network/docs",
          activeRoutes: [],
          target: "_blank"
        }
      ]
    }
  ];

  const onToggleMenuClick = () => {
    setIsHovering(false);

    onOpenMenuClick();
  };

  const onDrawerHover = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isHovering && !(event.relatedTarget instanceof Window)) {
      setIsHovering(true);
    }
  };

  const drawer = (
    <div
      style={{ width: _isNavOpen ? drawerWidth : closedDrawerWidth }}
      className="border-muted-foreground/20 bg-popover dark:bg-background box-border flex h-full flex-shrink-0 flex-col items-center justify-between overflow-y-auto overflow-x-hidden border-r-[1px] transition-[width] duration-300 ease-in-out md:h-[calc(100%-57px)]"
    >
      <div className={cn("flex w-full flex-col items-center justify-between", { ["p-2"]: _isNavOpen, ["pb-2 pt-2"]: !_isNavOpen })}>
        {(!isProvider || !isOnline) && (
          <Link
            className={cn(buttonVariants({ variant: "default", size: _isNavOpen ? "lg" : "icon" }), "h-[45px] w-full leading-4", {
              ["h-[45px] w-[45px] min-w-0 pb-2 pt-2"]: !_isNavOpen
            })}
            href="/become-provider"
          >
            {_isNavOpen && "Become Provider "}
            <Rocket className={cn("rotate-45", { ["ml-4"]: _isNavOpen })} fontSize="small" />
          </Link>
        )}

        {routeGroups.map((g, i) => (
          <SidebarGroupMenu key={i} group={g} hasDivider={g.hasDivider} isNavOpen={_isNavOpen} />
        ))}
      </div>

      <div className="w-full">
        {_isNavOpen && (
          <div className="space-y-2 pb-4 pl-4 pr-4">
            {/* <NodeStatusBar /> */}

            <div className="flex items-center justify-center space-x-1 pt-4">
              <Link
                target="_blank"
                rel="noreferrer"
                href="https://discord.akash.network"
                className={cn(buttonVariants({ variant: "text", size: "icon" }), "h-8 w-8")}
              >
                <Discord className="h-5 w-5" />
                <span className="sr-only">Discord</span>
              </Link>

              <Link
                target="_blank"
                rel="noreferrer"
                href="https://twitter.com/akashnet_"
                className={cn(buttonVariants({ variant: "text", size: "icon" }), "h-8 w-8")}
              >
                <TwitterX className="h-5 w-5" />
                <span className="sr-only">Twitter</span>
              </Link>

              <Link
                target="_blank"
                rel="noreferrer"
                href="https://youtube.com/@AkashNetwork?si=cd2P3ZlAa4gNQw0X?sub_confirmation=1"
                className={cn(buttonVariants({ variant: "text", size: "icon" }), "h-8 w-8")}
              >
                <Youtube className="h-5 w-5" />
                <span className="sr-only">Youtube</span>
              </Link>

              <Link
                target="_blank"
                rel="noreferrer"
                href="https://github.com/akash-network/console"
                className={cn(buttonVariants({ variant: "text", size: "icon" }), "h-8 w-8")}
              >
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </Link>

              <ModeToggle />
            </div>

            {publicRuntimeConfig?.version && _isNavOpen && (
              <div className="text-muted-foreground flex flex-row items-center justify-center space-x-4 text-xs font-bold">
                <small>v{publicRuntimeConfig?.version}</small>
              </div>
            )}
          </div>
        )}

        {!smallScreen && (
          <div className="border-muted-foreground/20 flex items-center justify-between border-t px-3 py-1">
            <Button size="icon" variant="ghost" onClick={onToggleMenuClick}>
              {isNavOpen ? <MenuScale /> : <Menu />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <nav
      className={cn("ease bg-header/95 fixed z-[100] md:flex-shrink-0", {
        ["md:w-[240px]"]: _isNavOpen || isHovering,
        ["md:w-[57px]"]: !(_isNavOpen || isHovering)
      })}
    >
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={isMobileOpen}
        disableScrollLock
        onClose={handleDrawerToggle}
        className="block p-4 md:hidden"
        ModalProps={{
          keepMounted: true // Better open performance on mobile.
        }}
        sx={{
          display: { xs: "block", sm: "block", md: "none" },
          "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, overflow: "hidden" }
        }}
        PaperProps={{
          sx: {
            border: "none"
          }
        }}
      >
        {drawer}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        className="hidden md:block"
        variant="permanent"
        onMouseEnter={onDrawerHover}
        onMouseLeave={() => setIsHovering(false)}
        PaperProps={{
          className: cn("border-none ease z-[1000] bg-header/95 transition-[width] duration-300 box-border overflow-hidden mt-[57px]", {
            ["md:w-[240px]"]: _isNavOpen,
            ["md:w-[57px]"]: !_isNavOpen
          })
        }}
        open
      >
        {drawer}
      </Drawer>
    </nav>
  );
};
