"use client";
import type { CSSProperties, ReactNode } from "react";
import React, { Suspense, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { IntlProvider } from "react-intl";
import { ErrorFallback, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { useMediaQuery, useTheme as useMuiTheme } from "@mui/material";

import { ACCOUNT_BAR_HEIGHT } from "@src/config/ui.config";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useOnboardingChrome } from "@src/hooks/useOnboardingChrome";
import { useTopBanner } from "@src/hooks/useTopBanner";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import { Nav } from "./Nav";
import { Sidebar } from "./Sidebar";
import { TrackingScripts } from "./TrackingScripts";

/**
 * Offsets the desktop sidebar by the live header height (nav + banner) so it follows the header when the banner
 * wraps to extra lines, instead of a fixed guess. Re-adding ACCOUNT_BAR_HEIGHT to the height cancels the nav
 * offset the drawer's inner content already subtracts, so the sidebar bottom still lands on the viewport edge.
 */
const APP_HEADER_HEIGHT_CSS = `var(--app-header-height, ${ACCOUNT_BAR_HEIGHT + 40}px)`;
const SIDEBAR_BELOW_BANNER_STYLE: CSSProperties = {
  marginTop: APP_HEADER_HEIGHT_CSS,
  height: `calc(100% - ${APP_HEADER_HEIGHT_CSS} + ${ACCOUNT_BAR_HEIGHT}px)`
};

type Props = {
  isLoading?: boolean;
  isUsingSettings?: boolean;
  isUsingWallet?: boolean;
  disableContainer?: boolean;
  containerClassName?: string;
  background?: "default" | "white";
  children?: ReactNode;
};

const Layout: React.FunctionComponent<Props> = ({ children, isLoading, isUsingSettings, isUsingWallet, disableContainer, containerClassName, background }) => {
  const [locale, setLocale] = useState("en-US");

  useEffect(() => {
    if (navigator?.language) {
      setLocale(navigator?.language);
    }
  }, []);

  return (
    <IntlProvider locale={locale} defaultLocale="en-US">
      <LayoutApp
        isLoading={isLoading}
        isUsingSettings={isUsingSettings}
        isUsingWallet={isUsingWallet}
        disableContainer={disableContainer}
        containerClassName={containerClassName}
        background={background}
      >
        {children}
      </LayoutApp>
    </IntlProvider>
  );
};

const LayoutApp: React.FunctionComponent<Props> = ({
  children,
  isLoading,
  isUsingSettings,
  isUsingWallet,
  disableContainer,
  containerClassName = "",
  background = "default"
}) => {
  const muiTheme = useMuiTheme();
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));
  const [isNavOpen, setIsNavOpen] = useState(() => {
    const _isNavOpen = localStorage.getItem("isNavOpen");

    if (_isNavOpen !== null && !smallScreen) {
      return _isNavOpen === "true";
    }

    return true;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { isSettingsInit } = useSettings();
  const { isWalletLoaded } = useWallet();
  const { hasBanner } = useTopBanner();
  const { isStripped } = useOnboardingChrome();

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
    <div className={cn("flex h-full flex-col", { "min-h-screen bg-white text-foreground": background === "white" })}>
      <div className="w-full flex-1" style={{ marginTop: `var(--app-header-height, ${ACCOUNT_BAR_HEIGHT + (hasBanner ? 40 : 0)}px)` }}>
        <div className="h-full overflow-x-auto">
          <Nav isMobileOpen={isMobileOpen} handleDrawerToggle={handleDrawerToggle} minimal={isStripped} />

          <div className="block h-full w-full flex-grow rounded-none md:flex">
            {!isStripped && (
              <Sidebar
                onOpenMenuClick={onOpenMenuClick}
                isNavOpen={isNavOpen}
                handleDrawerToggle={handleDrawerToggle}
                isMobileOpen={isMobileOpen}
                mdDrawerPaperStyle={hasBanner ? SIDEBAR_BELOW_BANNER_STYLE : undefined}
              />
            )}

            <div
              className={cn("ease ml-0 h-full flex-grow overflow-x-auto transition-[margin-left] duration-300", {
                ["md:ml-[240px]"]: !isStripped && isNavOpen,
                ["md:ml-[57px]"]: !isStripped && !isNavOpen
              })}
            >
              {isLoading !== undefined && <LinearLoadingSkeleton isLoading={isLoading} />}

              <ErrorBoundary FallbackComponent={ErrorFallback}>
                {!isUsingSettings || isSettingsInit ? (
                  !isUsingWallet || isWalletLoaded ? (
                    <div className={cn({ ["container p-6 pb-8"]: !disableContainer }, containerClassName)}>{children}</div>
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

      <Suspense fallback={null}>
        <TrackingScripts />
      </Suspense>
    </div>
  );
};

export const Loading: React.FunctionComponent<{ text: string; testId?: string }> = ({ text, testId }) => {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center pb-12 pt-12" data-testid={testId}>
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
