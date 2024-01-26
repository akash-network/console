"use client";
import React, { ReactNode, useState } from "react";
import { accountBarHeight, closedDrawerWidth, drawerWidth } from "@src/utils/constants";
import { UrlService } from "@src/utils/urlUtils";
import { SidebarGroupMenu } from "./SidebarGroupMenu";
import Link from "next/link";
import { LinkTo } from "../shared/LinkTo";
import { DiscordIcon } from "../shared/icons";
import { NodeStatusBar } from "./NodeStatusBar";
import { useAtom } from "jotai";
import sdlStore from "@src/store/sdlStore";
import { MobileSidebarUser } from "./MobileSidebarUser";
import { breakpoints } from "@src/utils/responsiveUtils";
import { useMediaQuery } from "usehooks-ts";
import { Badge } from "../ui/badge";
import { Button, buttonVariants } from "../ui/button";
import { cn } from "@src/utils/styleUtils";
import { Rocket, StatsUpSquare, ArrowUpRightSquare, Github, X as TwitterX, Discord, Menu, MenuScale } from "iconoir-react";
// import Drawer from "react-modern-drawer";
import { Drawer } from "@rewind-ui/core";

// const useStyles = makeStyles()(theme => ({
//   version: {
//     fontSize: ".7rem",
//     fontWeight: "bold",
//     color: theme.palette.grey[500],
//     textAlign: "left"
//   },
//   comingSoonTooltip: {
//     backgroundColor: theme.palette.secondary.main
//   },
//   akashImage: {
//     height: "12px"
//   },
//   socialLinks: {
//     display: "flex",
//     transition: ".3s all ease",
//     margin: 0,
//     padding: 0,
//     "& li": {
//       margin: "0 .5rem",
//       display: "flex",
//       alignItems: "center"
//     },
//     "& path": {
//       fill: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.common.black,
//       transition: ".3s all ease"
//     }
//   },
//   socialIcon: {
//     height: "1.5rem",
//     width: "1.5rem",
//     display: "block",
//     margin: "0 .2rem",
//     "&:hover": {
//       color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.primary.main,
//       "& path": {
//         fill: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.primary.main
//       }
//     }
//   },
//   caption: {
//     color: theme.palette.mode === "dark" ? theme.palette.grey["400"] : theme.palette.grey["600"],
//     fontWeight: "bold",
//     fontSize: ".6rem"
//   }
// }));

type Props = {
  children?: ReactNode;
  version: string;
  isMobileOpen: boolean;
  handleDrawerToggle: () => void;
  onOpenMenuClick: () => void;
  isNavOpen: boolean;
};

export const Sidebar: React.FunctionComponent<Props> = ({ isMobileOpen, version, handleDrawerToggle, isNavOpen, onOpenMenuClick }) => {
  // const { classes } = useStyles();
  // const theme = useTheme();
  const [isHovering, setIsHovering] = useState(false);
  const _isNavOpen = isNavOpen || isHovering;
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  // TODO Verify
  const smallScreen = useMediaQuery(breakpoints.md.mediaQuery);
  const mobileScreen = useMediaQuery(breakpoints.xs.mediaQuery);

  const routeGroups: ISidebarGroupMenu[] = [
    {
      hasDivider: false,
      routes: [
        {
          title: "Home",
          // icon: props => <HomeIcon {...props} />,
          url: UrlService.home(),
          activeRoutes: [UrlService.home()]
        },
        {
          title: "Deployments",
          // icon: props => <CloudIcon {...props} />,
          url: UrlService.deploymentList(),
          activeRoutes: [UrlService.deploymentList(), "/deployments", "/new-deployment"]
        },
        {
          title: "Templates",
          // icon: props => <CollectionsIcon {...props} />,
          url: UrlService.templates(),
          activeRoutes: [UrlService.templates()]
        },
        {
          title: "SDL Builder",
          // icon: props => <ConstructionIcon {...props} />,
          url: UrlService.sdlBuilder(),
          activeRoutes: [UrlService.sdlBuilder()]
        },
        {
          title: "Providers",
          // icon: props => <DnsIcon {...props} />,
          url: UrlService.providers(),
          activeRoutes: [UrlService.providers()]
        },
        {
          title: "Akashlytics",
          // icon: props => <InsightsIcon {...props} />,
          url: UrlService.analytics(),
          activeRoutes: [UrlService.analytics()]
        },
        {
          title: "Price Compare",
          // icon: props => <SavingsIcon {...props} />,
          url: UrlService.priceCompare(),
          activeRoutes: [UrlService.priceCompare()]
        },
        {
          title: "FAQ",
          // icon: props => <HelpIcon {...props} />,
          url: UrlService.faq(),
          activeRoutes: [UrlService.faq()]
        },
        {
          title: "Settings",
          // icon: props => <SettingsIcon {...props} />,
          url: UrlService.settings(),
          activeRoutes: [UrlService.settings()]
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
      className={`flex h-full flex-col items-center justify-between md:h-[calc(100%-${accountBarHeight}px)] transition-width flex-shrink-0 overflow-y-auto border-r-[1px] border-muted-foreground/20 transition-[width] duration-300 ease-in-out`}
      // sx={{
      //   height: { xs: "100%", sx: "100%", md: `calc(100% - ${accountBarHeight}px)` },
      //   display: "flex",
      //   flexDirection: "column",
      //   alignItems: "center",
      //   justifyContent: "space-between",
      //   overflowY: "auto",
      //   flexShrink: 0,
      //   borderRight: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300]}`,
      //   transition: "width .3s ease",
      //   overflowX: "hidden",
      //   width: _isNavOpen ? drawerWidth : closedDrawerWidth
      // }}
    >
      <div
        className={cn("flex w-full flex-col items-center justify-between", { ["p-2"]: _isNavOpen, ["pb-2 pt-2"]: !_isNavOpen })}
        // sx={{
        //   display: "flex",
        //   flexDirection: "column",
        //   alignItems: "center",
        //   justifyContent: "space-between",
        //   padding: _isNavOpen ? ".5rem" : ".5rem 0",
        //   width: "100%"
        // }}
      >
        <Link
          className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-[45px] w-full leading-4", {
            ["h-[45px] w-[45px] min-w-0 pb-2 pt-2"]: !_isNavOpen
            // ["text-foreground"]: route.variant === "ghost"
          })}
          href={UrlService.newDeployment()}
          onClick={onDeployClick}
        >
          {_isNavOpen && "Deploy "}
          <Rocket className="ml-4" fontSize="small" />
        </Link>

        {/* {_isNavOpen ? (
          <Link
            component={Link}
            href={UrlService.newDeployment()}
            size="lg"
            variant="secondary"
            color="secondary"
            fullWidth
            sx={{ height: "45px", lineHeight: "1rem" }}
            onClick={onDeployClick}
          >
            Deploy <RocketLaunchIcon sx={{ marginLeft: "1rem" }} fontSize="small" />
          </Link>
        ) : (
          <Link
            size="large"
            component={Link}
            href={UrlService.newDeployment()}
            variant="contained"
            color="secondary"
            sx={{ padding: ".5rem 0", minWidth: _isNavOpen ? "initial" : 0, width: "45px", height: "45px" }}
            onClick={onDeployClick}
          >
            <RocketLaunchIcon fontSize="medium" />
          </Link>
        )} */}

        {/** TODO remove any */}
        {routeGroups.map((g, i) => (
          <SidebarGroupMenu key={i} group={g as any} hasDivider={g.hasDivider} isNavOpen={_isNavOpen} />
        ))}
      </div>

      <div className="w-full">
        {!smallScreen && <MobileSidebarUser />}

        {_isNavOpen && (
          <div className="pb-4 pl-4 pr-4">
            <NodeStatusBar />

            <div className="flex items-center justify-center pt-4">
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

              {/** TODO */}
              {/* <ModeToggle /> */}
            </div>

            {/* <div
              className="mt-4 flex items-center justify-around"
              // sx={{ display: "flex", alignItems: "center", justifyContent: "space-around", margin: "1rem 0 0" }}
            >
              <ul className={classes.socialLinks}>
                <li>
                  <LinkTo onClick={() => window.open("https://discord.gg/akash", "_blank")} className={classes.socialLinks}>
                    <DiscordIcon className={classes.socialIcon} />
                  </LinkTo>
                </li>
                <li>
                  <LinkTo
                    onClick={() => window.open("https://www.youtube.com/channel/UC1rgl1y8mtcQoa9R_RWO0UA?sub_confirmation=1", "_blank")}
                    className={classes.socialLinks}
                  >
                    <YouTubeIcon className={classes.socialIcon} />
                  </LinkTo>
                </li>
                <li>
                  <LinkTo onClick={() => window.open("https://twitter.com/cloudmosio", "_blank")} className={classes.socialLinks}>
                    <TwitterIcon className={classes.socialIcon} />
                  </LinkTo>
                </li>
                <li>
                  <LinkTo onClick={() => window.open("https://github.com/akash-network/cloudmos", "_blank")} className={classes.socialLinks}>
                    <GitHubIcon className={classes.socialIcon} />
                  </LinkTo>
                </li>
              </ul>
            </div> */}

            {version && _isNavOpen && (
              <div
                className="flex flex-col items-center justify-center"
                // sx={{ display: "flex", alignItems: "center", flexDirection: "column", justifyContent: "center" }}
              >
                <span
                  className="text-xs font-bold text-muted-foreground"
                  // variant="caption"
                  // sx={{
                  //   color: theme.palette.mode === "dark" ? theme.palette.grey["400"] : theme.palette.grey["600"],
                  //   fontWeight: "bold",
                  //   fontSize: ".6rem"
                  // }}
                >
                  <strong>v{version}</strong>
                </span>

                <Badge color="secondary" className="h-[12px] text-sm font-bold">
                  beta
                </Badge>
                {/* <Chip
        label="beta"
        color="secondary"
        size="small"
        sx={{
          height: "12px",
          fontSize: "10px",
          fontWeight: "bold"
        }}
      /> */}
              </div>
            )}
          </div>
        )}

        {!smallScreen && (
          <div
            className="flex items-center justify-between border-t border-muted-foreground/20 px-3 py-1"
            // sx={{
            //   padding: ".2rem .75rem",
            //   borderTop: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]}`,
            //   display: "flex",
            //   alignItems: "center",
            //   justifyContent: "space-between"
            // }}
          >
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
      style={{ width: !smallScreen ? 0 : _isNavOpen || isHovering ? drawerWidth : closedDrawerWidth, height: `calc(100% - ${accountBarHeight}px)` }}
      className="fixed z-[100] h-full md:flex-shrink-0"
      // sx={{
      //   position: "fixed",
      //   zIndex: 100,
      //   width: { md: _isNavOpen || isHovering ? drawerWidth : closedDrawerWidth },
      //   flexShrink: { md: 0 }
      // }}
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
