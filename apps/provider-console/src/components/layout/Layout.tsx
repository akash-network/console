"use client";
import React, { ReactNode, useEffect, useState } from "react";
import { IntlProvider } from "react-intl";
import { useMediaQuery, useTheme as useMuiTheme } from "@mui/material";

import { accountBarHeight } from "@src/utils/constants";
import { cn } from "@src/utils/styleUtils";
import Spinner from "../shared/Spinner";
import { Nav } from "./Nav";
import { Sidebar } from "./Sidebar";
import { useRouter } from "next/router";
import restClient from "@src/utils/restClient";

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
  const router = useRouter();
  useEffect(() => {
    if (navigator?.language) {
      setLocale(navigator?.language);
    }
  }, []);

  useEffect(() => {
    const checkProviderStatus = async () => {
      if (router.pathname !== "/") {
        try {
          const response = await restClient.get("/provider/status");
          const { provider, online } = response.data;

          if (provider && online) {
            if (router.pathname !== "/dashboard") {
              router.push("/dashboard");
            }
          } else if (provider && !online) {
            if (router.pathname !== "/provider-remedies") {
              router.push("/provider-remedies");
            }
          }
          // If provider is false, we don't redirect
        } catch (error) {
          console.error("Error checking provider status:", error);
        }
      }
    };

    checkProviderStatus();
  }, [router.pathname]);

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
  const [isShowingWelcome, setIsShowingWelcome] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));

  useEffect(() => {
    const _isNavOpen = localStorage.getItem("isNavOpen");

    if (_isNavOpen !== null && !smallScreen) {
      setIsNavOpen(_isNavOpen === "true");
    }
  });

  useEffect(() => {
    const agreedToTerms = localStorage.getItem("agreedToTerms") === "true";

    if (!agreedToTerms) {
      setIsShowingWelcome(true);
    }
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
      <div className="bg-card h-full">
        <div className="h-full w-full" style={{ marginTop: `${accountBarHeight}px` }}>
          <div className="h-full">
            <Nav isMobileOpen={isMobileOpen} handleDrawerToggle={handleDrawerToggle} />

            <div className="block h-full w-full flex-grow rounded-none md:flex">
              <Sidebar onOpenMenuClick={onOpenMenuClick} isNavOpen={isNavOpen} handleDrawerToggle={handleDrawerToggle} isMobileOpen={isMobileOpen} />

              <div
                className={cn("ease ml-0 h-full flex-grow transition-[margin-left] duration-300", {
                  ["md:ml-[240px]"]: isNavOpen,
                  ["md:ml-[57px]"]: !isNavOpen
                })}
              >
                <div className={cn({ ["container pb-8 pt-4 sm:pt-8"]: !disableContainer }, containerClassName)}>{children}</div>
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
