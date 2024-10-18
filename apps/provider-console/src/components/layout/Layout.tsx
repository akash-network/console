"use client";
import React, { ReactNode, useEffect, useState } from "react";
import { IntlProvider } from "react-intl";
import { useMediaQuery, useTheme as useMuiTheme } from "@mui/material";

import { accountBarHeight } from "@src/utils/constants";
import { cn } from "@src/utils/styleUtils";
import { Nav } from "./Nav";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";

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
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));

  useEffect(() => {
    const _isNavOpen = localStorage.getItem("isNavOpen");

    if (_isNavOpen !== null && !smallScreen) {
      setIsNavOpen(_isNavOpen === "true");
    }
  });

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
      <div className="bg-card min-h-full">
        <div className="h-full w-full" style={{ marginTop: `${accountBarHeight}px` }}>
          <div className="h-full">
            <Nav isMobileOpen={isMobileOpen} handleDrawerToggle={handleDrawerToggle} />
            <div className="block h-full w-full flex-grow rounded-none md:flex">
              <Sidebar onOpenMenuClick={onOpenMenuClick} isNavOpen={isNavOpen} handleDrawerToggle={handleDrawerToggle} isMobileOpen={isMobileOpen} />
              <div
                className={cn("ease ml-0 min-h-full flex-grow transition-[margin-left] duration-300", {
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

export default Layout;
