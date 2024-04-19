import React, { ReactNode, useEffect, useState } from "react";
import { IntlProvider } from "react-intl";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../shared/ErrorFallback";
import { accountBarHeight, closedDrawerWidth, drawerWidth } from "@src/utils/constants";
import { useMediaQuery, useTheme } from "@mui/material";
import { WelcomeModal } from "./WelcomeModal";
import { Sidebar } from "./Sidebar";
import { useSettings } from "@src/context/SettingsProvider";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import { Header } from "./Header";
import { useWallet } from "@src/context/WalletProvider";
import Spinner from "../shared/Spinner";
import { cn } from "@src/utils/styleUtils";
import { Nav } from "./Nav";

type Props = {
  isLoading?: boolean;
  isUsingSettings?: boolean;
  isUsingWallet?: boolean;
  children?: ReactNode;
};

// const useStyles = makeStyles()(theme => ({
//   root: {
//     width: "100%"
//   },
//   accountBar: {
//     height: `${accountBarHeight}px`,
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "space-between",
//     width: "100%",
//     borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300]}`
//   },
//   viewContentContainer: {
//     flexGrow: 1,
//     transition: "margin-left .3s ease"
//   }
// }));

const Layout: React.FunctionComponent<Props> = ({ children, isLoading, isUsingSettings, isUsingWallet }) => {
  const [locale, setLocale] = useState("en-US");

  useEffect(() => {
    if (navigator?.language) {
      setLocale(navigator?.language);
    }
  }, []);

  return (
    <IntlProvider locale={locale} defaultLocale="en-US">
      <LayoutApp isLoading={isLoading} isUsingSettings={isUsingSettings} isUsingWallet={isUsingWallet}>
        {children}
      </LayoutApp>
    </IntlProvider>
  );
};

const LayoutApp: React.FunctionComponent<Props> = ({ children, isLoading, isUsingSettings, isUsingWallet }) => {
  const theme = useTheme();
  const [isShowingWelcome, setIsShowingWelcome] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { refreshNodeStatuses, isSettingsInit } = useSettings();
  const { isWalletLoaded } = useWallet();
  const smallScreen = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    const _isNavOpen = localStorage.getItem("isNavOpen");

    if (_isNavOpen !== null && !smallScreen) {
      setIsNavOpen(_isNavOpen === "true");
    }

    const refreshNodeIntervalId = setInterval(async () => {
      await refreshNodeStatuses();
    }, 60_000); // refresh every 1min

    return () => {
      clearInterval(refreshNodeIntervalId);
    };
  }, [refreshNodeStatuses]);

  useEffect(() => {
    const agreedToTerms = localStorage.getItem("agreedToTerms") === "true";

    if (!agreedToTerms) {
      setIsShowingWelcome(true);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onWelcomeClose = () => {
    localStorage.setItem("agreedToTerms", "true");
    setIsShowingWelcome(false);
  };

  const onOpenMenuClick = () => {
    setIsNavOpen(prev => {
      const newValue = !prev;

      localStorage.setItem("isNavOpen", newValue ? "true" : "false");

      return newValue;
    });
  };

  const handleDrawerToggle = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  return (
    <>
      {/* <WelcomeModal open={isShowingWelcome} onClose={onWelcomeClose} /> */}

      {/* <Box sx={{ height: "100%" }}>
        <Box className={classes.root} sx={{ marginTop: `${accountBarHeight}px`, height: "100%" }}>
          <Box height="100%">
            <Header isMobileOpen={isMobileOpen} handleDrawerToggle={handleDrawerToggle} />

            <Box
              sx={{
                display: { xs: "block", sx: "block", md: "flex" },
                width: "100%",
                borderRadius: 0,
                flexGrow: 1,
                height: "100%"
              }}
            >
              <Sidebar onOpenMenuClick={onOpenMenuClick} isNavOpen={isNavOpen} handleDrawerToggle={handleDrawerToggle} isMobileOpen={isMobileOpen} />

              <Box
                className={classes.viewContentContainer}
                sx={{ marginLeft: { xs: 0, sm: 0, md: isNavOpen ? `${drawerWidth}px` : `${closedDrawerWidth}px` }, minWidth: 0 }}
              >
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  {isLoading !== undefined && <LinearLoadingSkeleton isLoading={isLoading} />}

                  {!isUsingSettings || isSettingsInit ? (
                    !isUsingWallet || isWalletLoaded ? (
                      children
                    ) : (
                      <Loading text="Loading wallet..." />
                    )
                  ) : (
                    <Loading text="Loading settings..." />
                  )}
                </ErrorBoundary>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box> */}

      <div
        className="h-full"
        // sx={{ height: "100%" }}
      >
        <div
          className="h-full w-full"
          style={{ marginTop: `${accountBarHeight}px` }}
          // className={classes.root} sx={{ marginTop: `${accountBarHeight}px`, height: "100%" }}
        >
          <div
            className="h-full"
            // height="100%"
          >
            {/* <Header isMobileOpen={isMobileOpen} handleDrawerToggle={handleDrawerToggle} /> */}
            <Nav />

            <div
              className="block h-full w-full flex-grow rounded-none md:flex"
              // sx={{
              //   display: { xs: "block", sx: "block", md: "flex" },
              //   width: "100%",
              //   borderRadius: 0,
              //   flexGrow: 1,
              //   height: "100%"
              // }}
            >
              <Sidebar onOpenMenuClick={onOpenMenuClick} isNavOpen={isNavOpen} handleDrawerToggle={handleDrawerToggle} isMobileOpen={isMobileOpen} />

              <div
                className={cn("ease ml-0 h-full flex-grow transition-[margin-left] duration-300", {
                  ["sm:ml-[240px]"]: isNavOpen,
                  ["sm:ml-[60px]"]: !isNavOpen
                })}
                // style={{ marginLeft: !smallScreen ? 0 : isNavOpen ? `${drawerWidth}px` : `${closedDrawerWidth}px` }}
                // className={classes.viewContentContainer}
                // sx={{ marginLeft: { xs: 0, sm: 0, md: isNavOpen ? `${drawerWidth}px` : `${closedDrawerWidth}px` }, minWidth: 0 }}
                // viewContentContainer: {
                //   flexGrow: 1,
                //   transition: "margin-left .3s ease"
                // }
              >
                {isLoading !== undefined && <LinearLoadingSkeleton isLoading={isLoading} />}

                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  {!isUsingSettings || isSettingsInit ? (
                    !isUsingWallet || isWalletLoaded ? (
                      <div className="container h-full pb-8 pt-4 sm:pt-8">{children}</div>
                    ) : (
                      <Loading text="Loading wallet..." />
                    )
                  ) : (
                    <Loading text="Loading settings..." />
                  )}
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const Loading: React.FunctionComponent<{ text: string }> = ({ text }) => {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center pb-12 pt-12">
      <div className="pb-4">
        <Spinner size="large" />
      </div>
      <div>
        <h5>{text}</h5>
      </div>
    </div>
  );
};

export default Layout;
