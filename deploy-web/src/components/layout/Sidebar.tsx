import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import HomeIcon from "@mui/icons-material/Home";
import DnsIcon from "@mui/icons-material/Dns";
import React, { ReactNode, useState } from "react";
import { accountBarHeight, closedDrawerWidth, drawerWidth } from "@src/utils/constants";
import getConfig from "next/config";
import { makeStyles } from "tss-react/mui";
import { UrlService } from "@src/utils/urlUtils";
import CloudIcon from "@mui/icons-material/Cloud";
import { SidebarGroupMenu } from "./SidebarGroupMenu";
import { Button, Chip, IconButton, Typography, useMediaQuery } from "@mui/material";
import CollectionsIcon from "@mui/icons-material/Collections";
import SettingsIcon from "@mui/icons-material/Settings";
import Link from "next/link";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import { LinkTo } from "../shared/LinkTo";
import YouTubeIcon from "@mui/icons-material/YouTube";
import TwitterIcon from "@mui/icons-material/Twitter";
import LaunchIcon from "@mui/icons-material/Launch";
import GitHubIcon from "@mui/icons-material/GitHub";
import { DiscordIcon } from "../shared/icons";
import { NodeStatusBar } from "./NodeStatusBar";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";
import SavingsIcon from "@mui/icons-material/Savings";
import ConstructionIcon from "@mui/icons-material/Construction";
import InsightsIcon from "@mui/icons-material/Insights";
import HelpIcon from "@mui/icons-material/Help";
import { useAtom } from "jotai";
import sdlStore from "@src/store/sdlStore";
import { MobileSidebarUser } from "./MobileSidebarUser";

const { publicRuntimeConfig } = getConfig();

const useStyles = makeStyles()(theme => ({
  version: {
    fontSize: ".7rem",
    fontWeight: "bold",
    color: theme.palette.grey[500],
    textAlign: "left"
  },
  comingSoonTooltip: {
    backgroundColor: theme.palette.secondary.main
  },
  akashImage: {
    height: "12px"
  },
  socialLinks: {
    display: "flex",
    transition: ".3s all ease",
    margin: 0,
    padding: 0,
    "& li": {
      margin: "0 .5rem",
      display: "flex",
      alignItems: "center"
    },
    "& path": {
      fill: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.common.black,
      transition: ".3s all ease"
    }
  },
  socialIcon: {
    height: "1.5rem",
    width: "1.5rem",
    display: "block",
    margin: "0 .2rem",
    "&:hover": {
      color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.primary.main,
      "& path": {
        fill: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.primary.main
      }
    }
  },
  caption: {
    color: theme.palette.mode === "dark" ? theme.palette.grey["400"] : theme.palette.grey["600"],
    fontWeight: "bold",
    fontSize: ".6rem"
  }
}));

type Props = {
  children?: ReactNode;
  isMobileOpen: boolean;
  handleDrawerToggle: () => void;
  onOpenMenuClick: () => void;
  isNavOpen: boolean;
};

export const Sidebar: React.FunctionComponent<Props> = ({ isMobileOpen, handleDrawerToggle, isNavOpen, onOpenMenuClick }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const [isHovering, setIsHovering] = useState(false);
  const _isNavOpen = isNavOpen || isHovering;
  const [deploySdl, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const smallScreen = useMediaQuery(theme.breakpoints.down("md"));

  const routeGroups = [
    {
      hasDivider: false,
      routes: [
        {
          title: "Home",
          icon: props => <HomeIcon {...props} />,
          url: UrlService.home(),
          activeRoutes: [UrlService.home()]
        },
        {
          title: "Deployments",
          icon: props => <CloudIcon {...props} />,
          url: UrlService.deploymentList(),
          activeRoutes: [UrlService.deploymentList(), "/deployments", "/new-deployment"]
        },
        { title: "Templates", icon: props => <CollectionsIcon {...props} />, url: UrlService.templates(), activeRoutes: [UrlService.templates()] },
        {
          title: "SDL Builder",
          icon: props => <ConstructionIcon {...props} />,
          url: UrlService.sdlBuilder(),
          activeRoutes: [UrlService.sdlBuilder()]
        },
        { title: "Providers", icon: props => <DnsIcon {...props} />, url: UrlService.providers(), activeRoutes: [UrlService.providers()] },
        {
          title: "Akashlytics",
          icon: props => <InsightsIcon {...props} />,
          url: UrlService.analytics(),
          activeRoutes: [UrlService.analytics()]
        },
        {
          title: "Price Compare",
          icon: props => <SavingsIcon {...props} />,
          url: UrlService.priceCompare(),
          activeRoutes: [UrlService.priceCompare()]
        },
        { title: "FAQ", icon: props => <HelpIcon {...props} />, url: UrlService.faq(), activeRoutes: [UrlService.faq()] },
        { title: "Settings", icon: props => <SettingsIcon {...props} />, url: UrlService.settings(), activeRoutes: [UrlService.settings()] }
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

  const version = publicRuntimeConfig?.version && _isNavOpen && (
    <Box sx={{ display: "flex", alignItems: "center", flexDirection: "column", justifyContent: "center" }}>
      <Typography
        variant="caption"
        sx={{
          color: theme.palette.mode === "dark" ? theme.palette.grey["400"] : theme.palette.grey["600"],
          fontWeight: "bold",
          fontSize: ".6rem"
        }}
      >
        <strong>v{publicRuntimeConfig?.version}</strong>
      </Typography>

      <Chip
        label="beta"
        color="secondary"
        size="small"
        sx={{
          height: "12px",
          fontSize: "10px",
          fontWeight: "bold"
        }}
      />
    </Box>
  );

  const drawer = (
    <Box
      sx={{
        height: { xs: "100%", sx: "100%", md: `calc(100% - ${accountBarHeight}px)` },
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        overflowY: "auto",
        flexShrink: 0,
        borderRight: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300]}`,
        transition: "width .3s ease",
        overflowX: "hidden",
        width: _isNavOpen ? drawerWidth : closedDrawerWidth
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: _isNavOpen ? ".5rem" : ".5rem 0",
          width: "100%"
        }}
      >
        {_isNavOpen ? (
          <Button
            component={Link}
            href={UrlService.newDeployment()}
            size="large"
            variant="contained"
            color="secondary"
            fullWidth
            sx={{ height: "45px", lineHeight: "1rem" }}
            onClick={onDeployClick}
          >
            Deploy <RocketLaunchIcon sx={{ marginLeft: "1rem" }} fontSize="small" />
          </Button>
        ) : (
          <Button
            size="large"
            component={Link}
            href={UrlService.newDeployment()}
            variant="contained"
            color="secondary"
            sx={{ padding: ".5rem 0", minWidth: _isNavOpen ? "initial" : 0, width: "45px", height: "45px" }}
            onClick={onDeployClick}
          >
            <RocketLaunchIcon fontSize="medium" />
          </Button>
        )}

        {routeGroups.map((g, i) => (
          <SidebarGroupMenu key={i} group={g} hasDivider={g.hasDivider} isNavOpen={_isNavOpen} />
        ))}
      </Box>

      <Box sx={{ width: "100%" }}>
        {smallScreen && <MobileSidebarUser />}

        {_isNavOpen && (
          <Box sx={{ padding: "0 1rem 1rem" }}>
            <NodeStatusBar />

            {!smallScreen && (
              <Button
                onClick={() =>
                  window.open(
                    "https://wallet.keplr.app/chains/akash?modal=validator&chain=akashnet-2&validator_address=akashvaloper14mt78hz73d9tdwpdvkd59ne9509kxw8yj7qy8f",
                    "_blank"
                  )
                }
                size="small"
                fullWidth
              >
                <Typography variant="caption" className={classes.caption} sx={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                  Support our Validator <LaunchIcon fontSize="small" sx={{ marginLeft: ".2rem" }} />
                </Typography>
              </Button>
            )}

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-around", margin: "1rem 0 0" }}>
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

              {version}
            </Box>
          </Box>
        )}

        {!smallScreen && (
          <Box
            sx={{
              padding: ".2rem .75rem",
              borderTop: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <IconButton size="small" onClick={onToggleMenuClick}>
              {isNavOpen ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{
        position: "fixed",
        zIndex: 100,
        width: { md: _isNavOpen || isHovering ? drawerWidth : closedDrawerWidth },
        flexShrink: { md: 0 }
      }}
      aria-label="mailbox folders"
    >
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={isMobileOpen}
        disableScrollLock
        onClose={handleDrawerToggle}
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
        variant="permanent"
        sx={{
          display: { xs: "none", sm: "none", md: "block" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: _isNavOpen || isHovering ? drawerWidth : closedDrawerWidth,
            overflow: "hidden",
            marginTop: `${accountBarHeight}px`,
            transition: "width .3s ease",
            zIndex: 1000
          }
        }}
        onMouseEnter={onDrawerHover}
        onMouseLeave={() => setIsHovering(false)}
        PaperProps={{
          sx: {
            border: "none"
          }
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
  );
};
