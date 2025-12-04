"use client";
import type { ReactNode } from "react";
import React, { useMemo } from "react";
import { Button, buttonVariants, Separator } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import Drawer from "@mui/material/Drawer";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { ClassValue } from "clsx";
import {
  Book,
  Cloud,
  Discord,
  EvPlug,
  Github,
  HeadsetHelp,
  Heart,
  Home,
  InfoCircle,
  MessageAlert,
  MoneySquare,
  MoreHorizCircle,
  MultiplePages,
  Page,
  Rocket,
  Server,
  Settings,
  SidebarCollapse,
  SidebarExpand,
  StatsUpSquare,
  Tools,
  X as TwitterX,
  Youtube
} from "iconoir-react";
import { useAtom } from "jotai";
import Image from "next/image";
import Link from "next/link";

import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import sdlStore from "@src/store/sdlStore";
import type { ISidebarGroupMenu, ISidebarRoute } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";
import { MobileSidebarUser } from "./MobileSidebarUser";
import { ModeToggle } from "./ModeToggle";
import { NodeStatusBar } from "./NodeStatusBar";
import { SidebarGroupMenu } from "./SidebarGroupMenu";

type Props = {
  children?: ReactNode;
  isMobileOpen: boolean;
  handleDrawerToggle: () => void;
  onOpenMenuClick: () => void;
  isNavOpen: boolean;
  mdDrawerClassName?: ClassValue;
};

const DRAWER_WIDTH = 240;
const CLOSED_DRAWER_WIDTH = 57;

export const Sidebar: React.FunctionComponent<Props> = ({ isMobileOpen, handleDrawerToggle, isNavOpen, onOpenMenuClick, mdDrawerClassName }) => {
  const { settings } = useSettings();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const muiTheme = useMuiTheme();
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));
  const wallet = useWallet();
  const { user } = useUser();
  const isAlertsEnabled = useFlag("alerts");

  const mainRoutes = useMemo(() => {
    const routes: ISidebarRoute[] = [
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
        activeRoutes: [UrlService.sdlBuilder()],
        testId: "sidebar-sdl-builder-link"
      },
      {
        title: "Providers",
        icon: props => <Server {...props} />,
        url: UrlService.providers(),
        activeRoutes: [UrlService.providers()]
      }
    ];

    if (isAlertsEnabled && user?.userId && wallet.isManaged) {
      routes.push({
        title: "Alerts",
        icon: props => <MessageAlert {...props} />,
        url: UrlService.alerts(),
        activeRoutes: [UrlService.alerts()]
      });
    }

    return routes;
  }, [isAlertsEnabled, user?.userId, wallet.isManaged]);

  const routeGroups: ISidebarGroupMenu[] = useMemo(
    () => [
      {
        hasDivider: false,
        routes: mainRoutes
      }
    ],
    [mainRoutes]
  );

  const extraRoutes: ISidebarGroupMenu[] = useMemo(() => {
    const routes: ISidebarGroupMenu[] = [
      {
        hasDivider: false,
        routes: [
          {
            title: "Follow Akash",
            icon: props => <Heart {...props} />,
            hoveredRoutes: [
              {
                hasDivider: false,
                routes: [
                  {
                    title: "Akash Github",
                    icon: props => <Github {...props} />,
                    url: "https://github.com/akash-network/console",
                    target: "_blank",
                    rel: "noreferrer noopener"
                  },
                  {
                    title: "Akash on X",
                    icon: props => <TwitterX {...props} />,
                    url: "https://twitter.com/akashnet",
                    target: "_blank",
                    rel: "noreferrer noopener"
                  },

                  {
                    title: "Akash Youtube",
                    icon: props => <Youtube {...props} />,
                    url: "https://youtube.com/@AkashNetwork?si=cd2P3ZlAa4gNQw0X&sub_confirmation=1",
                    target: "_blank",
                    rel: "noreferrer noopener"
                  },
                  {
                    title: "Akash Discord",
                    icon: props => <Discord {...props} />,
                    url: "https://discord.akash.network",
                    target: "_blank",
                    rel: "noreferrer noopener"
                  }
                ]
              }
            ]
          },
          {
            title: "Resources",
            icon: props => <InfoCircle {...props} />,
            hoveredRoutes: [
              {
                hasDivider: false,
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
                    icon: props => <StatsUpSquare {...props} />,
                    url: "https://stats.akash.network",
                    activeRoutes: [],
                    target: "_blank",
                    hasDivider: true
                  },
                  {
                    title: "Price Compare",
                    icon: props => <MoneySquare {...props} />,
                    url: "https://akash.network/about/pricing/custom/",
                    activeRoutes: [],
                    target: "_blank"
                  },
                  {
                    title: "Akash Console API",
                    icon: props => <EvPlug {...props} />,
                    url: "https://console-api.akash.network/v1/swagger",
                    activeRoutes: [],
                    target: "_blank"
                  },
                  {
                    title: "Docs",
                    icon: props => <Book {...props} />,
                    url: "https://akash.network/docs",
                    activeRoutes: [],
                    target: "_blank"
                  },
                  {
                    title: "FAQ",
                    icon: props => <Page {...props} />,
                    url: UrlService.faq(),
                    activeRoutes: [UrlService.faq()]
                  }
                ]
              }
            ]
          },
          {
            title: "Help from Expert",
            icon: props => <HeadsetHelp {...props} />,
            url: "https://share.hsforms.com/29tSLilX9Qye5Rxrlsz7WPwsaima",
            activeRoutes: [],
            target: "_blank",
            isNew: true
          },
          ...(wallet.isWalletConnected && !wallet.isManaged
            ? [
                {
                  title: "App Settings",
                  icon: props => <Settings {...props} />,
                  url: UrlService.settings(),
                  activeRoutes: [UrlService.settings()]
                } as ISidebarRoute
              ]
            : []),
          {
            title: "More Info",
            icon: props => <MoreHorizCircle {...props} />,
            hoveredRoutes: [
              {
                hasDivider: false,
                routes: [
                  ...(wallet.isWalletConnected && !wallet.isManaged
                    ? [
                        {
                          customComponent: <NodeStatusBar />
                        } as ISidebarRoute
                      ]
                    : []),
                  {
                    title: "Privacy Policy",
                    url: UrlService.privacyPolicy()
                  },
                  {
                    title: "Terms of Service",
                    url: UrlService.termsOfService()
                  },
                  {
                    title: "Contact",
                    url: UrlService.contact()
                  },
                  {
                    customComponent: (
                      <div className="text-muted-foreground">
                        <Separator className="my-1" />
                        <div className="px-4 py-2 text-sm">Version {process.env.NEXT_PUBLIC_APP_VERSION}</div>

                        <div className="px-4 py-2">
                          <ModeToggle />
                        </div>
                      </div>
                    )
                  }
                ]
              }
            ]
          } as ISidebarRoute
        ]
      }
    ];

    return routes;
  }, [wallet]);

  const onToggleMenuClick = () => {
    onOpenMenuClick();
  };

  const onDeployClick = () => {
    setDeploySdl(null);
  };

  const drawer = (
    <div
      style={{ width: isNavOpen ? DRAWER_WIDTH : CLOSED_DRAWER_WIDTH }}
      className="box-border flex h-full flex-shrink-0 flex-col items-center justify-between overflow-y-auto overflow-x-hidden border-r-[1px] border-muted-foreground/20 bg-popover transition-[width] duration-300 ease-in-out md:h-[calc(100%-57px)] dark:bg-card"
    >
      <div className={cn("flex w-full flex-col items-center justify-between", { ["p-2"]: isNavOpen, ["pb-2 pt-2"]: !isNavOpen })}>
        <Link
          className={cn(buttonVariants({ variant: "default", size: isNavOpen ? "lg" : "icon" }), "h-[45px] w-full leading-4", {
            ["h-[45px] w-[45px] min-w-0 pb-2 pt-2"]: !isNavOpen
          })}
          href={UrlService.newDeployment()}
          onClick={onDeployClick}
          data-testid="sidebar-deploy-button"
          aria-disabled={settings.isBlockchainDown}
        >
          <Rocket className={cn("rotate-45", { ["mr-4"]: isNavOpen })} fontSize="small" />
          {isNavOpen && "Deploy "}
        </Link>

        {routeGroups.map((g, i) => (
          <SidebarGroupMenu key={i} group={g} hasDivider={g.hasDivider} isNavOpen={isNavOpen} />
        ))}
      </div>

      <div className={cn("flex w-full flex-col items-center justify-between", { ["p-2"]: isNavOpen, ["pb-2 pt-2"]: !isNavOpen })}>
        {extraRoutes.map((g, i) => (
          <SidebarGroupMenu key={i} group={g} hasDivider={g.hasDivider} isNavOpen={isNavOpen} />
        ))}

        {smallScreen && <MobileSidebarUser />}

        {!smallScreen && (
          <div className="flex w-full items-center justify-center pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleMenuClick}
              className={cn("flex w-full items-center justify-start gap-3 px-4", { ["w-[45px] min-w-0 justify-center p-2"]: !isNavOpen })}
            >
              {isNavOpen ? <SidebarCollapse /> : <SidebarExpand />}
              {isNavOpen && <span>Collapse</span>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <nav
      className={cn("ease fixed z-[100] bg-card md:flex-shrink-0", {
        ["md:w-[240px]"]: isNavOpen,
        ["md:w-[57px]"]: !isNavOpen
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
          "& .MuiDrawer-paper": { boxSizing: "border-box", width: DRAWER_WIDTH, overflow: "hidden" },
          zIndex: 990
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
        PaperProps={{
          className: cn(
            "border-none ease z-[1000] bg-card transition-[width] duration-300 box-border overflow-hidden mt-[57px]",
            {
              ["md:w-[240px]"]: isNavOpen,
              ["md:w-[57px]"]: !isNavOpen
            },
            mdDrawerClassName
          )
        }}
        open
      >
        {drawer}
      </Drawer>
    </nav>
  );
};
