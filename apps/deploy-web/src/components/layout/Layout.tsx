"use client";
import React, { ReactNode, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { IntlProvider } from "react-intl";
import { ErrorFallback, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { useMediaQuery, useTheme as useMuiTheme } from "@mui/material";

import { ACCOUNT_BAR_HEIGHT } from "@src/config/ui.config";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useHasCreditCardBanner } from "@src/hooks/useHasCreditCardBanner";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import { CreditCardBanner } from "./CreditCardBanner";
import { Nav } from "./Nav";
import { Sidebar } from "./Sidebar";

type Props = {
  isLoading?: boolean;
  isUsingSettings?: boolean;
  isUsingWallet?: boolean;
  disableContainer?: boolean;
  containerClassName?: string;
  children?: ReactNode;
};

const Layout: React.FunctionComponent<Props> = ({ children, isLoading, isUsingSettings, isUsingWallet, disableContainer, containerClassName }) => {
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
      >
        {children}
      </LayoutApp>
    </IntlProvider>
  );
};

const LayoutApp: React.FunctionComponent<Props> = ({ children, isLoading, isUsingSettings, isUsingWallet, disableContainer, containerClassName = "" }) => {
  const muiTheme = useMuiTheme();
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { refreshNodeStatuses, isSettingsInit } = useSettings();
  const { isWalletLoaded } = useWallet();
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));
  const hasCreditCardBanner = useHasCreditCardBanner();

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
    <div className="flex h-full">
      {hasCreditCardBanner && <CreditCardBanner />}

      <div className="w-full flex-1" style={{ marginTop: `${ACCOUNT_BAR_HEIGHT + (hasCreditCardBanner ? 40 : 0)}px` }}>
        <div className="h-full">
          <Nav isMobileOpen={isMobileOpen} handleDrawerToggle={handleDrawerToggle} className={{ "top-[40px]": hasCreditCardBanner }} />

          <div className="block h-full w-full flex-grow rounded-none md:flex">
            <Sidebar
              onOpenMenuClick={onOpenMenuClick}
              isNavOpen={isNavOpen}
              handleDrawerToggle={handleDrawerToggle}
              isMobileOpen={isMobileOpen}
              mdDrawerClassName={{ ["h-[calc(100%-40px)] mt-[97px]"]: hasCreditCardBanner }}
            />

            <div
              className={cn("ease ml-0 h-full flex-grow transition-[margin-left] duration-300", {
                ["md:ml-[240px]"]: isNavOpen,
                ["md:ml-[57px]"]: !isNavOpen
              })}
            >
              {isLoading !== undefined && <LinearLoadingSkeleton isLoading={isLoading} />}

              <ErrorBoundary FallbackComponent={ErrorFallback}>
                {!isUsingSettings || isSettingsInit ? (
                  !isUsingWallet || isWalletLoaded ? (
                    <div className={cn({ ["container pb-8 pt-4"]: !disableContainer }, containerClassName)}>{children}</div>
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
  );
};

export const Loading: React.FunctionComponent<{ text: string }> = ({ text }) => {
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
