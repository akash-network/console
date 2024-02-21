"use client";
import { Nav } from "./Nav";
import { useEffect, useState } from "react";
import { useMediaQuery } from "usehooks-ts";
import { useSettings } from "@src/context/SettingsProvider";
// import { WelcomeModal } from "./WelcomeModal";
import { breakpoints } from "@src/utils/responsiveUtils";
import { closedDrawerWidth, drawerWidth } from "@src/utils/constants";
import { Sidebar } from "./Sidebar";

export function AppLayoutContainer({ children, version }: React.PropsWithChildren<{ version: string }>) {
  const [isShowingWelcome, setIsShowingWelcome] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { refreshNodeStatuses } = useSettings();
  // TODO Verify
  // TODO Fix the breakpoints
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
          className="h-full w-full"
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
              <Sidebar
                onOpenMenuClick={onOpenMenuClick}
                isNavOpen={isNavOpen}
                handleDrawerToggle={handleDrawerToggle}
                isMobileOpen={isMobileOpen}
                version={version}
              />

              <div
                className="ease ml-0 h-full flex-grow transition-[margin-left] duration-300 md:ml-[240px]"
                style={{ marginLeft: !smallScreen ? 0 : isNavOpen ? `${drawerWidth}px` : `${closedDrawerWidth}px` }}
                // className={classes.viewContentContainer}
                // sx={{ marginLeft: { xs: 0, sm: 0, md: isNavOpen ? `${drawerWidth}px` : `${closedDrawerWidth}px` }, minWidth: 0 }}
                // viewContentContainer: {
                //   flexGrow: 1,
                //   transition: "margin-left .3s ease"
                // }
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
