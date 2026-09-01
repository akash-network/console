import "@akashnetwork/ui/styles";
import "nprogress/nprogress.css";
import "../styles/index.css";

import React from "react";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { CustomSnackbarProvider, PopupProvider } from "@akashnetwork/ui/context";
import { cn } from "@akashnetwork/ui/utils";
import { AppCacheProvider } from "@mui/material-nextjs/v14-pagesRouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { GeistSans } from "geist/font/sans";
import { Provider as JotaiProvider } from "jotai";
import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import Router from "next/router";
import { NavigationGuardProvider } from "next-navigation-guard";
import type { NextSeoProps } from "next-seo/lib/types";
import NProgress from "nprogress";

import { AccountCreatedTracker } from "@src/components/analytics/AccountCreatedTracker/AccountCreatedTracker";
import { AppBootstrap } from "@src/components/AppBootstrap/AppBootstrap";
import { RequireAuth } from "@src/components/auth/RequireAuth/RequireAuth";
import { AddCreditsHost } from "@src/components/billing-usage/AddCreditsHost/AddCreditsHost";
import { AppThemeProvider } from "@src/components/layout/AppThemeProvider";
import { CustomIntlProvider } from "@src/components/layout/CustomIntlProvider";
import { PageHead } from "@src/components/layout/PageHead";
import { RequireOnboarding } from "@src/components/onboarding/RequireOnboarding/RequireOnboarding";
import { UserProviders } from "@src/components/user/UserProviders/UserProviders";
import { BlockchainStatusProvider } from "@src/context/BlockchainStatusProvider";
import { BootLoadingProvider } from "@src/context/BootLoadingProvider/BootLoadingProvider";
import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { FlagProvider, WaitForFeatureFlags } from "@src/context/FlagProvider/FlagProvider";
import { PaymentPollingProvider } from "@src/context/PaymentPollingProvider";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { RootContainerProvider, useRootContainer } from "@src/context/ServicesProvider/RootContainerProvider";
import { WalletProvider } from "@src/context/WalletProvider";
import type { PageWithAuth } from "@src/lib/pages/definePublicPage";
import { store } from "@src/store/global-store";

interface Props extends AppProps {
  seo?: NextSeoProps;
}

NProgress.configure({
  minimum: 0.2
});

//Binding events.
Router.events.on("routeChangeStart", () => NProgress.start());
Router.events.on("routeChangeComplete", () => NProgress.done());
Router.events.on("routeChangeError", () => NProgress.done());

const App: React.FunctionComponent<Props> = props => {
  const { Component, pageProps } = props;
  const isPublic = (Component as PageWithAuth).auth === "public";

  return (
    <AppRoot {...props}>
      <BootLoadingProvider>
        <UserProviders>
          <AccountCreatedTracker />
          <RequireAuth isPublic={isPublic}>
            <FlagProvider>
              <WalletProvider>
                <PaymentPollingProvider>
                  <AddCreditsHost />
                  <NavigationGuardProvider>
                    <RequireOnboarding isPublic={isPublic}>
                      <WaitForFeatureFlags>
                        <Component {...pageProps} />
                      </WaitForFeatureFlags>
                    </RequireOnboarding>
                  </NavigationGuardProvider>
                </PaymentPollingProvider>
              </WalletProvider>
            </FlagProvider>
          </RequireAuth>
        </UserProviders>
      </BootLoadingProvider>
    </AppRoot>
  );
};

export default App;

const LocalNoteManager = dynamic(() => import("@src/components/LocalNoteManager/LocalNoteManager").then(mod => mod.LocalNoteManager), {
  ssr: false
});
function AppRoot(props: Props & { children: React.ReactNode }) {
  const { queryClient } = useRootContainer();
  return (
    <main className={cn("h-full bg-background font-sans antialiased", GeistSans.variable)}>
      <PageHead pageSeo={props.pageProps.seo} />

      <RootContainerProvider>
        <AppCacheProvider {...props}>
          <CustomIntlProvider>
            <JotaiProvider store={store}>
              <QueryClientProvider client={queryClient}>
                <AppThemeProvider>
                  <ColorModeProvider>
                    <CustomSnackbarProvider>
                      <TooltipProvider>
                        <PopupProvider>
                          <BlockchainStatusProvider>
                            <ServicesProvider>
                              <AppBootstrap />
                              <LocalNoteManager />
                              {props.children}
                            </ServicesProvider>
                          </BlockchainStatusProvider>
                        </PopupProvider>
                      </TooltipProvider>
                    </CustomSnackbarProvider>
                  </ColorModeProvider>
                </AppThemeProvider>
              </QueryClientProvider>
            </JotaiProvider>
          </CustomIntlProvider>
        </AppCacheProvider>
      </RootContainerProvider>
    </main>
  );
}
