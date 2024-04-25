"use client";
import React, { ReactNode, useState } from "react";
import { accountBarHeight, closedDrawerWidth, drawerWidth } from "@src/utils/constants";
import { UrlService } from "@src/utils/urlUtils";
import { SidebarGroupMenu } from "./SidebarGroupMenu";
import Link from "next/link";
import { NodeStatusBar } from "./NodeStatusBar";
import { useAtom } from "jotai";
import sdlStore from "@src/store/sdlStore";
import { MobileSidebarUser } from "./MobileSidebarUser";
import { breakpoints } from "@src/utils/responsiveUtils";
import { useMediaQuery } from "usehooks-ts";
import { Badge } from "../ui/badge";
import { Button, buttonVariants } from "../ui/button";
import { cn } from "@src/utils/styleUtils";
import { Rocket, Github, X as TwitterX, Discord, Menu, MenuScale } from "iconoir-react";
import { Drawer } from "@rewind-ui/core";
import { Home, Cloud, MultiplePages, Tools, Server, OpenInWindow, HelpCircle, Settings } from "iconoir-react";
import { ISidebarGroupMenu } from "@src/types";
import getConfig from "next/config";
import { useTheme } from "@mui/material";
import { ModeToggle } from "./ModeToggle";

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
  const _isNavOpen = isNavOpen || isHovering;
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const theme = useTheme();
  const smallScreen = useMediaQuery(theme.breakpoints.down("md"));

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
          title: "Deployments",
          icon: props => <Cloud {...props} />,
          url: UrlService.deploymentList(),
          activeRoutes: [UrlService.deploymentList(), "/deployments", "/new-deployment"]
        },
        {
          title: "Templates",
          icon: props => <MultiplePages {...props} />,
          url: UrlService.templates(),
          activeRoutes: [UrlService.templates()]
        },
        {
          title: "SDL Builder",
          icon: props => <Tools {...props} />,
          url: UrlService.sdlBuilder(),
          activeRoutes: [UrlService.sdlBuilder()]
        },
        {
          title: "Providers",
          icon: props => <Server {...props} />,
          url: UrlService.providers(),
          activeRoutes: [UrlService.providers()]
        },
        {
          title: "FAQ",
          icon: props => <HelpCircle {...props} />,
          url: UrlService.faq(),
          activeRoutes: [UrlService.faq()]
        },
        {
          title: "Settings",
          icon: props => <Settings {...props} />,
          url: UrlService.settings(),
          activeRoutes: [UrlService.settings()]
        }
      ]
    },
    {
      hasDivider: true,
      routes: [
        {
          title: "Akash Network",
          icon: props => <img src="/images/akash-logo.svg" alt="Akash Logo" style={{ height: "20px" }} {...props} />,
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
          url: "https://api.cloudmos.io/v1/swagger",
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

  const onDeployClick = () => {
    setDeploySdl(null);
  };

  const drawer = (
    <div
      style={{ width: _isNavOpen ? drawerWidth : closedDrawerWidth }}
      className={`box-border flex h-full flex-shrink-0 flex-col items-center justify-between overflow-y-auto overflow-x-hidden border-r-[1px] border-muted-foreground/20 transition-[width] duration-300 ease-in-out`}
    >
      <div className={cn("flex w-full flex-col items-center justify-between", { ["p-2"]: _isNavOpen, ["pb-2 pt-2"]: !_isNavOpen })}>
        <Link
          className={cn(buttonVariants({ variant: "default", size: _isNavOpen ? "lg" : "icon" }), "h-[45px] w-full leading-4", {
            ["h-[45px] w-[45px] min-w-0 pb-2 pt-2"]: !_isNavOpen
          })}
          href={UrlService.newDeployment()}
          onClick={onDeployClick}
        >
          {_isNavOpen && "Deploy "}
          <Rocket className={cn("rotate-45", { ["ml-4"]: _isNavOpen })} fontSize="small" />
        </Link>

        {routeGroups.map((g, i) => (
          <SidebarGroupMenu key={i} group={g} hasDivider={g.hasDivider} isNavOpen={_isNavOpen} />
        ))}
      </div>

      <div className="w-full">
        {smallScreen && <MobileSidebarUser />}

        {_isNavOpen && (
          <div className="pb-4 pl-4 pr-4">
            <NodeStatusBar />

            <div className="flex items-center justify-center space-x-1 pt-4">
              <Link target="_blank" rel="noreferrer" href="https://twitter.com/akashnet_" className={cn(buttonVariants({ variant: "text", size: "icon" }))}>
                <TwitterX width="1.2rem" height="1.2rem" />
                <span className="sr-only">Twitter</span>
              </Link>

              <Link
                target="_blank"
                rel="noreferrer"
                href="https://github.com/akash-network/cloudmos"
                className={cn(buttonVariants({ variant: "text", size: "icon" }))}
              >
                <Github width="1.2rem" height="1.2rem" />
                <span className="sr-only">GitHub</span>
              </Link>

              <Link target="_blank" rel="noreferrer" href="https://discord.akash.network" className={cn(buttonVariants({ variant: "text", size: "icon" }))}>
                <Discord width="1.2rem" height="1.2rem" />
                <span className="sr-only">Twitter</span>
              </Link>
              <ModeToggle />
            </div>

            {publicRuntimeConfig?.version && _isNavOpen && (
              <div className="flex flex-row items-center justify-center">
                <div className="text-xs font-bold text-muted-foreground">v{publicRuntimeConfig?.version}</div>
              </div>
            )}
          </div>
        )}

        {!smallScreen && (
          <div className="flex items-center justify-between border-t border-muted-foreground/20 px-3 py-1">
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
      style={{
        // width: !mdScreen ? 0 : _isNavOpen || isHovering ? drawerWidth : closedDrawerWidth,
        height: `calc(100% - ${accountBarHeight}px)`
      }}
      className={cn("ease fixed z-[100] h-full bg-header/95  transition-[width] duration-300 md:flex-shrink-0", {
        ["md:w-[240px]"]: _isNavOpen || isHovering,
        ["md:w-[57px]"]: !(_isNavOpen || isHovering)
      })}
    >
      {/* Mobile Drawer */}
      <Drawer
        // variant="temporary"
        open={isMobileOpen}
        // disableScrollLock
        onClose={handleDrawerToggle}
        position="left"
        className="!bg-background p-4"
        // customIdSuffix="mobile-drawer"
        // overlayClassName="block md:hidden"
        // ModalProps={{
        //   keepMounted: true // Better open performance on mobile.
        // }}
        // sx={{
        //   display: { xs: "block", sm: "block", md: "none" },
        //   "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, overflow: "hidden" }
        // }}
        // PaperProps={{
        //   sx: {
        //     border: "none"
        //   }
        // }}
      >
        {drawer}
      </Drawer>

      {/* Desktop Drawer */}
      <div
        className="hidden h-full md:block"
        // variant="permanent"
        // sx={{
        //   display: { xs: "none", sm: "none", md: "block" },
        //   "& .MuiDrawer-paper": {
        //     boxSizing: "border-box",
        //     width: _isNavOpen || isHovering ? drawerWidth : closedDrawerWidth,
        //     overflow: "hidden",
        //     marginTop: `${accountBarHeight}px`,
        //     transition: "width .3s ease",
        //     zIndex: 1000
        //   }
        // }}
        onMouseEnter={onDrawerHover}
        onMouseLeave={() => setIsHovering(false)}
        // PaperProps={{
        //   sx: {
        //     border: "none"
        //   }
        // }}
        // open
      >
        {drawer}
      </div>
    </nav>
  );
};
