"use client";
import type { ReactNode } from "react";
import React, { Suspense, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { IntlProvider } from "react-intl";
import { ErrorFallback, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { ACCOUNT_BAR_HEIGHT } from "@src/config/ui.config";
import { useSettings } from "@src/context/SettingsProvider";
import { useOnboardingChrome } from "@src/hooks/useOnboardingChrome";
import { useTopBanner } from "@src/hooks/useTopBanner";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import { TopNav } from "./TopNav/TopNav";
import { TrackingScripts } from "./TrackingScripts";

export const DEPENDENCIES = {
  LinearLoadingSkeleton,
  TopNav,
  TrackingScripts,
  useOnboardingChrome,
  useSettings,
  useTopBanner
};

type Props = {
  isLoading?: boolean;
  isUsingSettings?: boolean;
  disableContainer?: boolean;
  containerClassName?: string;
  background?: "default" | "white";
  children?: ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

const Layout: React.FunctionComponent<Props> = ({ children, isLoading, isUsingSettings, disableContainer, containerClassName, background, dependencies }) => {
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
        disableContainer={disableContainer}
        containerClassName={containerClassName}
        background={background}
        dependencies={dependencies}
      >
        {children}
      </LayoutApp>
    </IntlProvider>
  );
};

const LayoutApp: React.FunctionComponent<Props> = ({
  children,
  isLoading = false,
  isUsingSettings,
  disableContainer,
  containerClassName = "",
  background = "default",
  dependencies: d = DEPENDENCIES
}) => {
  const { LinearLoadingSkeleton, TopNav, TrackingScripts, useOnboardingChrome, useSettings, useTopBanner } = d;
  const { isSettingsInit } = useSettings();
  const { hasBanner } = useTopBanner();
  const { isStripped } = useOnboardingChrome();

  return (
    <div className={cn("flex h-full flex-col", { "min-h-screen bg-white text-foreground dark:bg-background": background === "white" })}>
      <div className="w-full flex-1" style={{ marginTop: `var(--app-header-height, ${ACCOUNT_BAR_HEIGHT + (hasBanner ? 40 : 0)}px)` }}>
        <div className="h-full overflow-x-auto">
          <TopNav minimal={isStripped} />

          <div className="block h-full w-full flex-grow rounded-none md:flex">
            <div className="h-full flex-grow overflow-x-auto">
              <LinearLoadingSkeleton isLoading={isLoading} />

              <ErrorBoundary FallbackComponent={ErrorFallback}>
                {!isUsingSettings || isSettingsInit ? (
                  <div className={cn({ ["container p-6 pb-8"]: !disableContainer }, containerClassName)}>{children}</div>
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

export const Loading: React.FunctionComponent<{ text?: string; testId?: string }> = ({ text, testId }) => {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center pb-12 pt-12" data-testid={testId}>
      <Spinner size="large" />
      {text && <h5 className="pt-4">{text}</h5>}
    </div>
  );
};

export default Layout;
