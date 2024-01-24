"use client";

import { Nav } from "./Nav";
// import { Sidebar } from "./Sidebar";
import { useEffect, useState } from "react";
import { useWallet } from "@src/context/WalletProvider";
import { useMediaQuery } from "usehooks-ts";
import { useSettings } from "@src/context/SettingsProvider";
// import { WelcomeModal } from "./WelcomeModal";
import { ErrorFallback } from "../shared/ErrorFallback";
import { breakpoints } from "@src/utils/responsiveUtils";
import { closedDrawerWidth, drawerWidth } from "@src/utils/constants";

export function AppLayoutContainer({ children }: { children: React.ReactNode }) {
  const [isShowingWelcome, setIsShowingWelcome] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { refreshNodeStatuses } = useSettings();
  // TODO Verify
  const smallScreen = useMediaQuery(breakpoints.md.mediaQuery);

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
      {/* TODO */}
      {/* <WelcomeModal open={isShowingWelcome} onClose={onWelcomeClose} /> */}
      <div
        className="h-full"
        // sx={{ height: "100%" }}
      >
        <div
          className="mt-[58px] h-full w-full"
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
              {/* <Sidebar onOpenMenuClick={onOpenMenuClick} isNavOpen={isNavOpen} handleDrawerToggle={handleDrawerToggle} isMobileOpen={isMobileOpen} /> */}

              <div
                className="ml-0 flex-grow md:ml-[240px]"
                style={{ marginLeft: smallScreen ? 0 : isNavOpen ? `${drawerWidth}px` : `${closedDrawerWidth}px` }}
                // className={classes.viewContentContainer}
                // sx={{ marginLeft: { xs: 0, sm: 0, md: isNavOpen ? `${drawerWidth}px` : `${closedDrawerWidth}px` }, minWidth: 0 }}
              >
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
