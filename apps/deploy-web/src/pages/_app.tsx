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
import Router from "next/router";
import { NavigationGuardProvider } from "next-navigation-guard";
import type { NextSeoProps } from "next-seo/lib/types";
import { ThemeProvider } from "next-themes";
import NProgress from "nprogress";

import GoogleAnalytics from "@src/components/layout/CustomGoogleAnalytics";
import { CustomIntlProvider } from "@src/components/layout/CustomIntlProvider";
import { Loading } from "@src/components/layout/Layout";
import { PageHead } from "@src/components/layout/PageHead";
import { ClientOnlyTurnstile } from "@src/components/turnstile/Turnstile";
import { UserProviders } from "@src/components/user/UserProviders/UserProviders";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { BackgroundTaskProvider } from "@src/context/BackgroundTaskProvider";
import { CertificateProvider } from "@src/context/CertificateProvider";
import { ChainParamProvider } from "@src/context/ChainParamProvider";
import { CustomChainProvider } from "@src/context/CustomChainProvider";
import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { FlagProvider } from "@src/context/FlagProvider/FlagProvider";
import { JwtProvider } from "@src/context/JwtProvider/JwtProviderContext";
import { LocalNoteProvider } from "@src/context/LocalNoteProvider";
import { PaymentPollingProvider } from "@src/context/PaymentPollingProvider";
import { PricingProvider } from "@src/context/PricingProvider/PricingProvider";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { RootContainerProvider, useRootContainer } from "@src/context/ServicesProvider/RootContainerProvider";
import { SettingsProvider } from "@src/context/SettingsProvider";
import { WalletProvider } from "@src/context/WalletProvider";
import { useInjectedConfig } from "@src/hooks/useInjectedConfig";
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
  const { config, isLoaded: isLoadedInjectedConfig } = useInjectedConfig();

  if (!isLoadedInjectedConfig) {
    return (
      <AppRoot {...props}>
        <Loading text="Loading settings..." />
      </AppRoot>
    );
  }

  return (
    <AppRoot {...props}>
      <>
        <ClientOnlyTurnstile
          enabled={config?.NEXT_PUBLIC_TURNSTILE_ENABLED || browserEnvConfig.NEXT_PUBLIC_TURNSTILE_ENABLED}
          siteKey={config?.NEXT_PUBLIC_TURNSTILE_SITE_KEY || browserEnvConfig.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        />

        <GoogleAnalytics />

        <UserProviders>
          <FlagProvider>
            <WalletProvider>
              <PaymentPollingProvider>
                <CertificateProvider>
                  <JwtProvider>
                    <BackgroundTaskProvider>
                      <NavigationGuardProvider>
                        <Component {...pageProps} />
                      </NavigationGuardProvider>
                    </BackgroundTaskProvider>
                  </JwtProvider>
                </CertificateProvider>
              </PaymentPollingProvider>
            </WalletProvider>
          </FlagProvider>
        </UserProviders>
      </>
    </AppRoot>
  );
};

export default App;

function AppRoot(props: Props & { children: React.ReactNode }) {
  const { queryClient } = useRootContainer();
  return (
    <main className={cn("h-full bg-background font-sans tracking-wide antialiased", GeistSans.variable)}>
      <PageHead pageSeo={props.pageProps.seo} />

      <RootContainerProvider>
        <AppCacheProvider {...props}>
          <CustomIntlProvider>
            <JotaiProvider store={store}>
              <QueryClientProvider client={queryClient}>
                <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
                  <ColorModeProvider>
                    <CustomSnackbarProvider>
                      <TooltipProvider>
                        <PopupProvider>
                          <PricingProvider>
                            <SettingsProvider>
                              <ServicesProvider>
                                <CustomChainProvider>
                                  <ChainParamProvider>
                                    <LocalNoteProvider>{props.children}</LocalNoteProvider>
                                  </ChainParamProvider>
                                </CustomChainProvider>
                              </ServicesProvider>
                            </SettingsProvider>
                          </PricingProvider>
                        </PopupProvider>
                      </TooltipProvider>
                    </CustomSnackbarProvider>
                  </ColorModeProvider>
                </ThemeProvider>
              </QueryClientProvider>
            </JotaiProvider>
          </CustomIntlProvider>
        </AppCacheProvider>
      </RootContainerProvider>
    </main>
  );
}
