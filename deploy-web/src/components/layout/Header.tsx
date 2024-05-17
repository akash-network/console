import React, { ReactNode } from "react";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../shared/ErrorFallback";
import { accountBarHeight, hasBanner } from "@src/utils/constants";
import { Badge, Button, IconButton, Typography, styled, useMediaQuery, useTheme } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import Image from "next/legacy/image";
import { WalletStatus } from "./WalletStatus";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { useRouter } from "next/router";
import { AccountMenu } from "./AccountMenu";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { useBannerHeight } from "@src/hooks/useBannerHeight";

type Props = {
  isMobileOpen: boolean;
  handleDrawerToggle: () => void;
  children?: ReactNode;
};

const useStyles = makeStyles()(theme => ({
  accountBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300]}`,
    backgroundColor: theme.palette.background.paper
  },
  bannerLink: {
    color: theme.palette.secondary.contrastText,
    textDecoration: "underline"
  }
}));

const StyledBadge = styled(Badge)(({ theme }) => ({
  "& .MuiBadge-badge": {
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.secondary.light,
    boxShadow: `0 0 0 2px ${theme.palette.secondary.main}`,
    right: 0,
    "&::after": {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      animation: "ripple 1.2s infinite ease-in-out",
      border: "1px solid currentColor",
      content: '""'
    }
  },
  "@keyframes ripple": {
    "0%": {
      transform: "scale(.8)",
      opacity: 1
    },
    "100%": {
      transform: "scale(3)",
      opacity: 0
    }
  }
}));

export const Header: React.FunctionComponent<Props> = ({ isMobileOpen, handleDrawerToggle }) => {
  const theme = useTheme();
  const { classes } = useStyles();
  const router = useRouter();
  const bannerHeight = useBannerHeight();

  return (
    <AppBar position="fixed" color="default" elevation={0} component="header">
      <Toolbar
        variant="dense"
        className={classes.accountBar}
        sx={{ flexDirection: "column", height: `${accountBarHeight + (hasBanner ? bannerHeight : 0)}px` }}
      >
        {hasBanner && (
          <Box
            sx={{
              height: bannerHeight,
              width: "100%",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "absolute",
              backgroundColor: theme.palette.secondary.main,
              padding: "0 1rem"
            }}
          >
            <Typography variant="body2">
              Cloudmos will be moving to{" "}
              <Link href="https://console.akash.network" target="_blank" className={classes.bannerLink}>
                console.akash.network
              </Link>{" "}
              soon. Please try out Console and let us know if you run into any issues.
            </Typography>
          </Box>
        )}
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              justifyContent: "space-between",
              flexGrow: 1,
              marginTop: hasBanner ? `${bannerHeight}px` : 0
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Box href={UrlService.home()} component={Link} sx={{ height: "35px", width: "140px" }}>
                <Image
                  alt="Cloudmos Logo"
                  src={theme.palette.mode === "dark" ? "/images/cloudmos-logo.png" : "/images/cloudmos-logo-light.png"}
                  layout="responsive"
                  quality={100}
                  width={140}
                  height={35}
                  loading="eager"
                  priority
                />
              </Box>
            </Box>

            <Box>
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ display: { md: "none" }, marginLeft: ".5rem" }}
              >
                {isMobileOpen ? <CloseIcon /> : <MenuIcon />}
              </IconButton>
            </Box>

            <Box sx={{ maxHeight: `${accountBarHeight}px`, alignItems: "center", display: { xs: "none", sm: "none", md: "flex" } }}>
              <div>
                <Link passHref href={UrlService.getStarted()}>
                  <StyledBadge overlap="circular" anchorOrigin={{ vertical: "top", horizontal: "right" }} variant="dot">
                    <Button
                      variant="text"
                      sx={{
                        textTransform: "initial",
                        color: router.pathname === UrlService.getStarted() ? theme.palette.secondary.main : "",
                        fontSize: "1rem"
                      }}
                      disableRipple
                    >
                      Get Started
                    </Button>
                  </StyledBadge>
                </Link>
              </div>

              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Box sx={{ marginLeft: "1rem" }}>
                  <WalletStatus />
                </Box>

                <AccountMenu />
              </Box>
            </Box>
          </Box>
        </ErrorBoundary>
      </Toolbar>
    </AppBar>
  );
};
