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
import YouTubeIcon from "@mui/icons-material/YouTube";
import GitHubIcon from "@mui/icons-material/GitHub";
import { DiscordIcon } from "../shared/icons";
import { NodeStatusBar } from "./NodeStatusBar";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";
import ConstructionIcon from "@mui/icons-material/Construction";
import HelpIcon from "@mui/icons-material/Help";
import LaunchIcon from "@mui/icons-material/Launch";
import { useAtom } from "jotai";
import sdlStore from "@src/store/sdlStore";
import { MobileSidebarUser } from "./MobileSidebarUser";
import { ISidebarGroupMenu } from "@src/types";
import { FaXTwitter } from "react-icons/fa6";

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
    listStyle: "none",
    display: "flex",
    padding: 0,
    margin: 0,
    [theme.breakpoints.down("sm")]: {
      justifyContent: "center"
    }
  },
  socialLink: {
    display: "block",
    padding: "0 .5rem",
    transition: ".3s all ease",
    "& path": {
      fill: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main,
      transition: ".3s all ease"
    },
    "&:hover": {
      color: theme.palette.secondary.main,
      "& path": {
        fill: theme.palette.secondary.main
      }
    }
  },
  socialIcon: {
    height: "1rem",
    width: "1rem",
    display: "block",
    margin: "0 .2rem"
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
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const smallScreen = useMediaQuery(theme.breakpoints.down("md"));

  const routeGroups: ISidebarGroupMenu[] = [
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

        { title: "FAQ", icon: props => <HelpIcon {...props} />, url: UrlService.faq(), activeRoutes: [UrlService.faq()] },
        { title: "Settings", icon: props => <SettingsIcon {...props} />, url: UrlService.settings(), activeRoutes: [UrlService.settings()] }
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
          icon: props => <LaunchIcon {...props} />,
          url: "https://stats.akash.network",
          activeRoutes: [],
          target: "_blank"
        },
        {
          title: "Price Compare",
          icon: props => <LaunchIcon {...props} />,
          url: "https://akash.network/about/pricing/custom/",
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
            sx={{ height: "45px", lineHeight: "1rem", overflow: "hidden" }}
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

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-around", margin: "1rem 0 0" }}>
              <ul className={classes.socialLinks}>
                <li>
                  <a href="https://discord.gg/akash" target="_blank" className={classes.socialLink}>
                    <DiscordIcon className={classes.socialIcon} />
                  </a>
                </li>
                <li>
                  <a href="https://www.youtube.com/@AkashNetwork" target="_blank" className={classes.socialLink}>
                    <YouTubeIcon className={classes.socialIcon} />
                  </a>
                </li>
                <li>
                  <a href="https://twitter.com/akashnet_" target="_blank" className={classes.socialLink}>
                    <FaXTwitter className={classes.socialIcon} />
                  </a>
                </li>
                <li>
                  <a href="https://github.com/akash-network/cloudmos" target="_blank" className={classes.socialLink}>
                    <GitHubIcon className={classes.socialIcon} />
                  </a>
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
